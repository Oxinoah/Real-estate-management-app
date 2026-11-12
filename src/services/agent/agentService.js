import { RENTAL_ACCEPTANCE_NOTICE, validateProperty, validateStats } from '../../utils/agent/rules.js';

const PAGE_SIZE = 200;
const PROPERTY_FIELDS = 'property_id,seller_id,agent_id,title,description,price,transaction_type,property_type,location,status,created_at,updated_at';
const RELATION = 'properties!inner(property_id,agent_id,title,transaction_type,status)';

function failure(error, context) {
  // Avoid echoing arbitrary server details, URLs or configuration into the UI.
  const known = {
    '42501': 'Access denied. Check your role and the property assignment.',
    '40001': 'This record changed. Refresh it before trying again.',
    '23505': 'An offer has already been accepted for this property.',
    '23514': 'This operation conflicts with the listing or decision rules.',
    'PGRST202': 'Agent database integration is not available. Ask the team to review and apply its SQL prerequisite.',
    '42P01': 'A required database table is unavailable.',
  };
  return new Error(`${context} ${known[error?.code] || 'The request failed. Check the connection and database prerequisites.'}`);
}

// Exact counts and small pages detect server caps instead of reporting partial totals.
export async function readAllPages(buildQuery, idField) {
  const rows = [];
  const ids = new Set();
  let expected;
  while (expected === undefined || rows.length < expected) {
    let result;
    try {
      result = await buildQuery().range(rows.length, rows.length + PAGE_SIZE - 1);
    } catch (error) {
      throw failure(error, 'Could not load records.');
    }
    const { data, error, count } = result;
    if (error) throw failure(error, 'Could not load records.');
    if (!Array.isArray(data) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('The database did not return a complete, counted result. Refresh to retry.');
    }
    if (expected !== undefined && expected !== count) {
      throw new Error('The records changed while loading. Refresh to retry.');
    }
    expected = count;
    if (data.length === 0 && rows.length < expected) {
      throw new Error('The database truncated the result. No partial result is displayed.');
    }
    for (const row of data) {
      const id = String(row[idField]);
      if (row[idField] == null || ids.has(id)) throw new Error('The records changed while loading. Refresh to retry.');
      ids.add(id);
      rows.push(row);
    }
    if (rows.length > expected) throw new Error('Inconsistent record count. Refresh to retry.');
  }
  return rows;
}

// Injection keeps tests offline; production passes the existing shared client.
export function createAgentService(client, agentId) {
  if (!agentId) throw new Error('An authenticated agent identity is required.');

  async function rpc(name, args = {}) {
    let result;
    try {
      result = await client.rpc(name, args);
    } catch (error) {
      throw failure(error, 'Agent action unavailable.');
    }
    const { data, error } = result;
    if (error) throw failure(error, 'Agent action unavailable.');
    if (data == null) throw new Error('The database did not confirm this operation. Refresh before retrying.');
    return data;
  }

  async function readiness() {
    const status = await rpc('agent_integration_status');
    if (status.version !== 1 || status.agent_id !== agentId || status.rental_acceptance !== false) {
      throw new Error('The Agent database contract is missing or incompatible. Ask the team to review the Agent integration.');
    }
    return status;
  }

  async function write(name, args, expected) {
    // Recheck the server role even if the screen was opened earlier.
    await readiness();
    const data = await rpc(name, args);
    if (typeof data !== 'object' || Array.isArray(data) ||
      Object.entries(expected).some(([key, value]) => String(data[key]) !== String(value))) {
      throw new Error('The database did not confirm the expected result. Refresh before retrying; do not assume the operation failed.');
    }
    return data;
  }

  function related(table, fields, idField, transactionType) {
    return readAllPages(() => {
      let query = client.from(table).select(`${fields},${RELATION}`, { count: 'exact' })
        .eq('properties.agent_id', agentId).order(idField, { ascending: true });
      if (transactionType) query = query.eq('properties.transaction_type', transactionType);
      return query;
    }, idField);
  }

  return {
    readiness,
    loadPortfolio: () => readAllPages(() => client.from('properties')
      .select(PROPERTY_FIELDS, { count: 'exact' }).eq('agent_id', agentId)
      .order('property_id', { ascending: true }), 'property_id'),
    async loadProperty(propertyId) {
      let result;
      try {
        result = await client.from('properties').select(PROPERTY_FIELDS)
          .eq('agent_id', agentId).eq('property_id', propertyId).single();
      } catch (error) {
        throw failure(error, 'Could not load the assigned property.');
      }
      const { data, error } = result;
      if (error || !data) throw failure(error, 'This property is unavailable or no longer assigned to you.');
      const [images, history] = await Promise.allSettled([
        readAllPages(() => client.from('property_images').select('image_id,url', { count: 'exact' })
          .eq('property_id', propertyId).order('image_id', { ascending: true }), 'image_id'),
        readAllPages(() => client.from('status_history').select('history_id,old_status,new_status,changed_by,changed_at', { count: 'exact' })
          .eq('property_id', propertyId).order('history_id', { ascending: true }), 'history_id'),
      ]);
      return { property: data, images, history };
    },
    loadEnquiries: () => related('enquiries', 'enquiry_id,property_id,buyer_id,message,response,created_at', 'enquiry_id'),
    loadOffers: () => related('offers', 'offer_id,property_id,buyer_id,amount,status,created_at', 'offer_id', 'sale'),
    loadApplications: () => related('rental_applications', 'application_id,property_id,buyer_id,move_in_date,notes,status,created_at', 'application_id', 'rent'),
    // A single SQL aggregate uses a complete database snapshot, without REST row limits.
    loadStats: async () => validateStats(await rpc('agent_portfolio_stats')),
    updateProperty(property, values) {
      const checked = validateProperty(values);
      if (checked.errors.length) throw new Error(checked.errors.join(' '));
      return write('agent_update_property', {
        p_property_id: property.property_id, p_expected_updated_at: property.updated_at, p_values: checked.values,
      }, { property_id: property.property_id, agent_id: agentId, ...checked.values });
    },
    changeStatus: (property, status) => write('agent_change_property_status', {
      p_property_id: property.property_id, p_expected_updated_at: property.updated_at, p_status: status,
    }, { property_id: property.property_id, agent_id: agentId, status }),
    reply(enquiry, response) {
      if (!response.trim()) throw new Error('Write a non-empty response.');
      return write('agent_reply_enquiry', {
        p_enquiry_id: enquiry.enquiry_id, p_response: response.trim(), p_expected_response: enquiry.response ?? null,
      }, { enquiry_id: enquiry.enquiry_id, response: response.trim() });
    },
    decideOffer(offerId, decision) {
      if (!['accepted', 'rejected'].includes(decision)) throw new Error('Choose acceptance or rejection.');
      return write('agent_decide_offer', { p_offer_id: offerId, p_decision: decision }, { offer_id: offerId, status: decision });
    },
    decideApplication(applicationId, decision) {
      if (decision !== 'rejected') throw new Error(RENTAL_ACCEPTANCE_NOTICE);
      return write('agent_reject_application', { p_application_id: applicationId }, { application_id: applicationId, status: 'rejected' });
    },
  };
}
