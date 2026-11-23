import { computeStats, validateProperty } from '../../utils/agent/rules.js';

// Agent data access. It uses the tables and security rules already in
// supabase/schema_02_core_tables.sql (agents can read and manage properties,
// answer enquiries and decide offers). `scope` is 'mine' (properties whose
// agent_id is this agent) or 'all' (every listing).
//
// The Supabase client is injected so this file can be tested without a network.

const BUYER = 'buyer:profiles!buyer_id(full_name)';
const PROPERTY = 'properties!inner(property_id,agent_id,title,location,transaction_type,status)';
// Loaded with each listing so the Properties tab can show what is waiting for an answer.
const WORK = 'offers(status),rental_applications(status),viewings(status),enquiries(response)';

function explain(error, context) {
  if (error?.code === '42501') return new Error(`${context} Access denied for this account.`);
  return new Error(`${context} ${error?.message || 'The request failed.'}`);
}

export function createAgentService(client, agentId) {
  if (!agentId) throw new Error('An authenticated agent identity is required.');

  async function run(query, context) {
    const { data, error } = await query;
    if (error) throw explain(error, context);
    return data;
  }

  function related(table, fields, scope, transactionType) {
    let query = client.from(table).select(`${fields},${BUYER},${PROPERTY}`)
      .order('created_at', { ascending: false });
    if (scope === 'mine') query = query.eq('properties.agent_id', agentId);
    if (transactionType) query = query.eq('properties.transaction_type', transactionType);
    return run(query, 'Could not load records.');
  }

  // Updates exactly one property row; zero rows means it changed or is not allowed.
  async function updateProperty(property, values, context) {
    const { data, error } = await client.from('properties').update(values)
      .eq('property_id', property.property_id).eq('updated_at', property.updated_at)
      .select().maybeSingle();
    if (error) throw explain(error, context);
    if (!data) throw new Error(`${context} This listing changed or is no longer available. Refresh and try again.`);
    return data;
  }

  return {
    agentId,

    async countAssigned() {
      const { count, error } = await client.from('properties')
        .select('property_id', { count: 'exact', head: true }).eq('agent_id', agentId);
      if (error) throw explain(error, 'Could not load properties.');
      return count || 0;
    },

    loadPortfolio(scope) {
      let query = client.from('properties').select(`*,property_images(url),seller:profiles!seller_id(full_name),${WORK}`)
        .order('created_at', { ascending: false });
      if (scope === 'mine') query = query.eq('agent_id', agentId);
      return run(query, 'Could not load properties.');
    },

    async loadProperty(propertyId) {
      const property = await run(client.from('properties')
        .select(`*,property_images(image_id,url),seller:profiles!seller_id(full_name),${WORK}`)
        .eq('property_id', propertyId).single(), 'Could not load this property.');
      const history = await run(client.from('status_history')
        .select('history_id,old_status,new_status,changed_at,changer:profiles!changed_by(full_name)')
        .eq('property_id', propertyId).order('history_id', { ascending: true }), 'Could not load the status history.');
      return { property, images: property.property_images || [], history };
    },

    loadEnquiries: (scope) => related('enquiries', 'enquiry_id,property_id,buyer_id,message,response,created_at', scope),
    loadOffers: (scope) => related('offers', 'offer_id,property_id,buyer_id,amount,status,created_at', scope, 'sale'),
    loadApplications: (scope) =>
      related('rental_applications', 'application_id,property_id,buyer_id,move_in_date,notes,status,created_at', scope, 'rent'),
    loadViewings: (scope) =>
      related('viewings', 'viewing_id,property_id,buyer_id,requested_datetime,status,created_at', scope),

    async loadStats(scope) {
      const properties = await this.loadPortfolio(scope);
      const offers = await related('offers', 'offer_id,property_id', scope);
      return computeStats(properties, offers);
    },

    // An agent can take a listing on (or release it) so it shows in "My properties".
    assign: (property, assigned) =>
      updateProperty(property, { agent_id: assigned ? agentId : null }, 'Could not change the assignment.'),

    // Takes on (or releases) several listings in one go. Only unassigned
    // listings are taken, and only the agent's own ones are released, so a
    // colleague's property is never taken over. Returns how many changed.
    async assignMany(propertyIds, assigned) {
      const ids = [...new Set(propertyIds)];
      if (!ids.length) throw new Error('Select at least one property.');
      let query = client.from('properties').update({ agent_id: assigned ? agentId : null }).in('property_id', ids);
      query = assigned ? query.is('agent_id', null) : query.eq('agent_id', agentId);
      const data = await run(query.select('property_id'), 'Could not change the assignment.');
      return data?.length || 0;
    },

    updateProperty(property, values) {
      const checked = validateProperty(values);
      if (checked.errors.length) throw new Error(checked.errors.join(' '));
      return updateProperty(property, checked.values, 'Could not save the listing.');
    },

    changeStatus: (property, status) => updateProperty(property, { status }, 'Could not change the status.'),

    async reply(enquiry, response) {
      if (!response.trim()) throw new Error('Write a non-empty response.');
      const data = await run(client.from('enquiries').update({ response: response.trim() })
        .eq('enquiry_id', enquiry.enquiry_id).select().maybeSingle(), 'Could not save the response.');
      if (!data) throw new Error('Could not save the response. This enquiry is no longer available.');
      return data;
    },

    async decideOffer(offerId, decision) {
      if (decision === 'accepted') {
        // Accepts it, rejects the other pending offers and sets the property to "under offer".
        return run(client.rpc('accept_offer', { p_offer_id: offerId }), 'Could not accept the offer.');
      }
      return setDecision('offers', 'offer_id', offerId, 'rejected', ['pending']);
    },

    async decideApplication(applicationId, decision) {
      if (decision === 'accepted') {
        // Needs supabase/schema_03_accept_rental.sql.
        const { error } = await client.rpc('accept_rental_application', { p_application_id: applicationId });
        if (error?.code === 'PGRST202') {
          throw new Error('Run supabase/schema_03_accept_rental.sql in the Supabase SQL Editor first.');
        }
        if (error) throw explain(error, 'Could not accept the application.');
        return true;
      }
      return setDecision('rental_applications', 'application_id', applicationId, 'rejected', ['pending']);
    },

    decideViewing: (viewingId, decision) =>
      setDecision('viewings', 'viewing_id', viewingId, decision, ['requested']),
  };

  async function setDecision(table, idField, id, status, from) {
    const data = await run(client.from(table).update({ status }).eq(idField, id).in('status', from)
      .select().maybeSingle(), 'Could not save the decision.');
    if (!data) throw new Error('This request was already processed. Refresh to see its current status.');
    return data;
  }
}
