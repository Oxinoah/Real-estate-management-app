import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { AgentButton, AgentCard, AgentLoadState, AgentMessage, styles } from '../../components/agent/AgentUI';
import { useAgentAction, useAgentResource } from '../../hooks/agent/useAgentResource';
import { dateTime, money, RENTAL_ACCEPTANCE_NOTICE } from '../../utils/agent/rules';

// Both decision lists share layout, not their business rules or RPCs.
export default function AgentDecisionsScreen({ service, revision, kind, onChanged }) {
  const rental = kind === 'applications';
  const resource = useAgentResource(() => rental ? service.loadApplications() : service.loadOffers(), [service, revision, rental]);
  return <ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.heading}>{rental ? 'Rental applications' : 'Purchase offers'}</Text>
    <AgentButton title="Refresh decisions" disabled={resource.loading} onPress={resource.refresh} />
    {rental ? <AgentMessage>{RENTAL_ACCEPTANCE_NOTICE} Pending applications on active rentals can be rejected without changing the listing status.</AgentMessage>
      : <AgentMessage>Accepting one pending offer rejects the other pending offers and sets the listing to Under Offer in one database transaction.</AgentMessage>}
    <AgentLoadState resource={resource} empty={rental ? 'No rental applications for your assigned properties.' : 'No purchase offers for your assigned properties.'}>
      {resource.data?.map((row) => <DecisionCard key={rental ? row.application_id : row.offer_id}
        row={row} rental={rental} service={service} onChanged={onChanged} />)}
    </AgentLoadState>
  </ScrollView>;
}

function DecisionCard({ row, rental, service, onChanged }) {
  const [decision, setDecision] = useState(null);
  const action = useAgentAction(onChanged);
  const available = row.status === 'pending' && row.properties.status === 'active';
  return <AgentCard>
    <Text style={styles.heading}>{row.properties.title}</Text>
    <Text style={styles.text}>{rental ? `Move-in date: ${row.move_in_date}` : money(row.amount)}</Text>
    {rental ? <Text style={styles.text}>{row.notes || 'No notes.'}</Text> : null}
    <Text style={styles.muted}>Decision: {row.status} · Listing: {row.properties.status}</Text>
    <Text style={styles.muted}>Buyer: {row.buyer_id} · {dateTime(row.created_at)}</Text>
    <AgentButton title={rental ? 'Acceptance unavailable' : 'Accept offer'} disabled={rental || !available || action.busy}
      onPress={() => setDecision('accepted')} />
    <AgentButton title={rental ? 'Reject application' : 'Reject offer'} disabled={!available || action.busy}
      onPress={() => setDecision('rejected')} />
    {decision ? <>
      <AgentMessage>Confirm {decision === 'accepted' ? 'acceptance? Other pending offers will be rejected.' : 'rejection? This decision cannot be undone here.'}</AgentMessage>
      <AgentButton title={action.busy ? 'Saving decision…' : 'Confirm decision'} primary disabled={action.busy}
        onPress={async () => {
          const save = () => rental ? service.decideApplication(row.application_id, decision) : service.decideOffer(row.offer_id, decision);
          if (await action.run(save, 'Decision saved.')) setDecision(null);
        }} />
      <AgentButton title="Cancel" disabled={action.busy} onPress={() => setDecision(null)} />
    </> : null}
    <AgentMessage error>{action.error}</AgentMessage>
  </AgentCard>;
}
