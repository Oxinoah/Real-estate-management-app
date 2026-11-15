import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AgentButton, AgentCard, AgentLoadState, AgentMessage, styles } from '../../components/agent/AgentUI';
import { useAgentAction, useAgentResource } from '../../hooks/agent/useAgentResource';
import { dateTime, money } from '../../utils/agent/rules';

const KINDS = [
  { key: 'offers', label: 'Offers' },
  { key: 'applications', label: 'Rentals' },
  { key: 'viewings', label: 'Viewings' },
];

const COPY = {
  offers: {
    empty: 'No purchase offers.',
    hint: 'Accepting an offer rejects the other pending offers and sets the property to "Under offer".',
    yes: 'Accept offer', no: 'Reject offer',
  },
  applications: {
    empty: 'No rental applications.',
    hint: 'Accepting an application rejects the other pending ones and marks the property as rented.',
    yes: 'Accept application', no: 'Reject application',
  },
  viewings: {
    empty: 'No viewing requests.',
    hint: 'The buyer sees your answer in My Activity.',
    yes: 'Confirm viewing', no: 'Decline viewing',
  },
};

// Agent "Requests" tab: what buyers sent (purchase offers, rental
// applications, viewing requests), with accept / reject buttons.
export default function AgentRequestsScreen({ service, scope, revision, onChanged }) {
  const [kind, setKind] = useState('offers');
  const resource = useAgentResource(() => {
    if (kind === 'applications') return service.loadApplications(scope);
    if (kind === 'viewings') return service.loadViewings(scope);
    return service.loadOffers(scope);
  }, [service, scope, revision, kind]);
  const copy = COPY[kind];
  return <ScrollView contentContainerStyle={styles.body}>
    <View style={styles.row}>{KINDS.map((k) => <AgentButton key={k.key} title={k.label}
      primary={kind === k.key} onPress={() => setKind(k.key)} />)}</View>
    <AgentMessage>{copy.hint}</AgentMessage>
    <AgentLoadState resource={resource} empty={copy.empty}>
      {resource.data?.map((row) => <RequestCard key={kind + (row.offer_id || row.application_id || row.viewing_id)}
        row={row} kind={kind} copy={copy} service={service} onChanged={onChanged} />)}
    </AgentLoadState>
  </ScrollView>;
}

function RequestCard({ row, kind, copy, service, onChanged }) {
  const [decision, setDecision] = useState(null);
  const action = useAgentAction(onChanged);
  const pending = kind === 'viewings' ? row.status === 'requested' : row.status === 'pending';
  // Offers and applications can only be decided while the listing is active.
  const available = pending && (kind === 'viewings' || row.properties.status === 'active');
  const yes = kind === 'viewings' ? 'confirmed' : 'accepted';
  const no = kind === 'viewings' ? 'declined' : 'rejected';

  let detail;
  if (kind === 'offers') detail = money(row.amount);
  else if (kind === 'applications') detail = `Move-in date: ${row.move_in_date}${row.notes ? ` · ${row.notes}` : ''}`;
  else detail = dateTime(row.requested_datetime);

  function save() {
    if (kind === 'offers') return service.decideOffer(row.offer_id, decision);
    if (kind === 'applications') return service.decideApplication(row.application_id, decision);
    return service.decideViewing(row.viewing_id, decision);
  }

  return <AgentCard>
    <Text style={styles.heading}>{row.properties.title}</Text>
    <Text style={styles.text}>{detail}</Text>
    <Text style={styles.muted}>
      {row.buyer?.full_name || 'Buyer'} · {dateTime(row.created_at)} · Status: {row.status}
    </Text>
    {pending && !available ? <AgentMessage>The listing is no longer active, so this request cannot be decided.</AgentMessage> : null}
    <View style={styles.row}>
      <AgentButton title={copy.yes} primary disabled={!available || action.busy} onPress={() => setDecision(yes)} />
      <AgentButton title={copy.no} disabled={!available || action.busy} onPress={() => setDecision(no)} />
    </View>
    {decision ? <>
      <AgentMessage>Confirm: {decision}? This cannot be undone here.</AgentMessage>
      <AgentButton title={action.busy ? 'Saving…' : 'Confirm'} primary disabled={action.busy}
        onPress={async () => { if (await action.run(save, `Request ${decision}.`)) setDecision(null); }} />
      <AgentButton title="Cancel" disabled={action.busy} onPress={() => setDecision(null)} />
    </> : null}
    <AgentMessage error>{action.error}</AgentMessage>
  </AgentCard>;
}
