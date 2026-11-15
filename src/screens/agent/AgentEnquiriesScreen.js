import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AgentButton, AgentCard, AgentField, AgentLoadState, AgentMessage, styles } from '../../components/agent/AgentUI';
import { useAgentAction, useAgentResource } from '../../hooks/agent/useAgentResource';
import { dateTime } from '../../utils/agent/rules';

// Agent "Enquiries" tab: buyer questions on the properties in scope, with a
// reply box. The reply appears in the buyer's My Activity.
export default function AgentEnquiriesScreen({ service, scope, revision, onChanged }) {
  const resource = useAgentResource(() => service.loadEnquiries(scope), [service, scope, revision]);
  const [filter, setFilter] = useState('all');
  const shown = resource.data?.filter((row) => filter === 'all' || (filter === 'answered' ? !!row.response?.trim() : !row.response?.trim()));
  return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <View style={styles.row}>{['all', 'waiting', 'answered'].map((value) => <AgentButton
      key={value} title={value} primary={filter === value} onPress={() => setFilter(value)} />)}</View>
    <AgentLoadState resource={resource} empty={scope === 'mine' ? 'No enquiries on your properties.' : 'No enquiries yet.'}>
      {shown?.length === 0 && resource.data?.length ? <AgentMessage>No enquiries match this filter.</AgentMessage> : null}
      {shown?.map((row) => <EnquiryCard key={row.enquiry_id} enquiry={row} service={service} onChanged={onChanged} />)}
    </AgentLoadState>
  </ScrollView>;
}

function EnquiryCard({ enquiry, service, onChanged }) {
  const [response, setResponse] = useState(enquiry.response || '');
  const action = useAgentAction(onChanged);
  return <AgentCard>
    <Text style={styles.heading}>{enquiry.properties.title}</Text>
    <Text style={styles.muted}>
      {enquiry.buyer?.full_name || 'Buyer'} · {dateTime(enquiry.created_at)} · {enquiry.response?.trim() ? 'Answered' : 'Waiting for a response'}
    </Text>
    <Text style={styles.text}>“{enquiry.message}”</Text>
    <AgentField label="Your response" multiline value={response} editable={!action.busy} onChangeText={setResponse} />
    <AgentMessage error>{action.error}</AgentMessage>
    <AgentButton title={action.busy ? 'Saving…' : enquiry.response ? 'Update response' : 'Send response'} primary
      disabled={action.busy || !response.trim()}
      onPress={() => action.run(() => service.reply(enquiry, response), 'Response sent.')} />
  </AgentCard>;
}
