import { canDeleteProperty, isLocked, validateProperty } from '../../utils/agent/rules.js';

// Seller data access (Supabase). Uses the tables and security rules of
// supabase/schema_02_core_tables.sql: a seller manages only the properties
// whose seller_id is their own id, and answers the offers, rental
// applications, viewing requests and enquiries sent on them.
//
// It has the same "load / decide / reply" functions as the Agent service, so
// the Requests and Enquiries screens are shared by both roles.
// The Supabase client is injected so this file can be tested without a network.

const BUYER = 'buyer:profiles!buyer_id(full_name)';
const PROPERTY = 'properties!inner(property_id,seller_id,title,location,transaction_type,status)';

// Sample photos (images "can be mocked" in the project brief).
export const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
];

// Prices come back from Postgres as numbers or strings ("485000.00").
function sameValue(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a ?? '').trim() === String(b ?? '').trim();
}

function explain(error, context) {
  if (error?.code === '42501') return new Error(`${context} Access denied for this account.`);
  return new Error(`${context} ${error?.message || 'The request failed.'}`);
}

export function createSellerService(client, sellerId) {
  if (!sellerId) throw new Error('A signed-in seller is required.');

  async function run(query, context) {
    const { data, error } = await query;
    if (error) throw explain(error, context);
    return data;
  }

  // Rows sent by buyers on this seller's properties.
  function related(table, fields, transactionType) {
    let query = client.from(table).select(`${fields},${BUYER},${PROPERTY}`)
      .eq('properties.seller_id', sellerId)
      .order('created_at', { ascending: false });
    if (transactionType) query = query.eq('properties.transaction_type', transactionType);
    return run(query, 'Could not load records.');
  }

  // Updates exactly one of the seller's rows; zero rows means it changed meanwhile.
  async function updateRow(property, values, context) {
    const { data, error } = await client.from('properties').update(values)
      .eq('property_id', property.property_id).eq('seller_id', sellerId)
      .eq('updated_at', property.updated_at)
      .select().maybeSingle();
    if (error) throw explain(error, context);
    if (!data) throw new Error(`${context} This listing changed or is no longer available. Refresh and try again.`);
    return data;
  }

  async function setDecision(table, idField, id, status, from) {
    const data = await run(client.from(table).update({ status }).eq(idField, id).in('status', from)
      .select().maybeSingle(), 'Could not save the decision.');
    if (!data) throw new Error('This request was already processed. Refresh to see its current status.');
    return data;
  }

  async function saveImages(propertyId, urls) {
    await run(client.from('property_images').delete().eq('property_id', propertyId), 'Could not update the photos.');
    if (urls.length) {
      await run(client.from('property_images').insert(urls.map((url) => ({ property_id: propertyId, url }))),
        'Could not save the photos.');
    }
  }

  return {
    sellerId,

    // "My properties", newest first, with photos and the number of pending requests.
    loadPortfolio() {
      return run(client.from('properties')
        .select('*,property_images(url),offers(status),rental_applications(status)')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false }), 'Could not load your properties.');
    },

    async loadProperty(propertyId) {
      const property = await run(client.from('properties')
        .select('*,property_images(image_id,url),agent:profiles!agent_id(full_name)')
        .eq('property_id', propertyId).eq('seller_id', sellerId).single(), 'Could not load this property.');
      const history = await run(client.from('status_history')
        .select('history_id,old_status,new_status,changed_at,changer:profiles!changed_by(full_name)')
        .eq('property_id', propertyId).order('history_id', { ascending: true }), 'Could not load the status history.');
      return { property, images: property.property_images || [], history };
    },

    // status is 'draft' ("Save as draft") or 'active' ("Publish").
    async createProperty(values, status, photos = []) {
      const checked = validateProperty(values);
      if (checked.errors.length) throw new Error(checked.errors.join(' '));
      if (!['draft', 'active'].includes(status)) throw new Error('A new listing is a draft or active.');
      const created = await run(client.from('properties')
        .insert({ ...checked.values, seller_id: sellerId, status }).select().single(),
      'Could not create the listing.');
      if (photos.length) await saveImages(created.property_id, photos);
      return created;
    },

    async updateProperty(property, values, photos) {
      const checked = validateProperty(values);
      if (checked.errors.length) throw new Error(checked.errors.join(' '));
      const changedLocked = Object.keys(checked.values).filter((field) =>
        isLocked(property, field) && !sameValue(checked.values[field], property[field]));
      if (property.status === 'sold' || property.status === 'rented') {
        throw new Error('A sold or rented listing can no longer be edited.');
      }
      if (changedLocked.length) {
        throw new Error('Price, type and location cannot be changed once the property is under offer.');
      }
      const saved = await updateRow(property, checked.values, 'Could not save the listing.');
      if (photos) await saveImages(property.property_id, photos);
      return saved;
    },

    async deleteProperty(property) {
      if (!canDeleteProperty(property)) {
        throw new Error('Only a draft or active listing can be deleted.');
      }
      const data = await run(client.from('properties').delete()
        .eq('property_id', property.property_id).eq('seller_id', sellerId).in('status', ['draft', 'active'])
        .select(), 'Could not delete the listing.');
      if (!data?.length) throw new Error('This listing changed or is no longer available. Refresh and try again.');
      return true;
    },

    changeStatus: (property, status) => updateRow(property, { status }, 'Could not change the status.'),

    // Same functions as the Agent service (scope is ignored: always "my properties").
    loadEnquiries: () => related('enquiries', 'enquiry_id,property_id,buyer_id,message,response,created_at'),
    loadOffers: () => related('offers', 'offer_id,property_id,buyer_id,amount,status,created_at', 'sale'),
    loadApplications: () =>
      related('rental_applications', 'application_id,property_id,buyer_id,move_in_date,notes,status,created_at', 'rent'),
    loadViewings: () =>
      related('viewings', 'viewing_id,property_id,buyer_id,requested_datetime,status,created_at'),

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
}

// Number of offers / applications still waiting for an answer on a listing.
export function pendingCount(property) {
  const rows = [...(property.offers || []), ...(property.rental_applications || [])];
  return rows.filter((r) => r.status === 'pending').length;
}
