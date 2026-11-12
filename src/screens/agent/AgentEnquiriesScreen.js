import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AgentButton, AgentCard, AgentField, AgentLoadState, AgentMessage, styles } from '../../components/agent/AgentUI';
import { useAgentAction, useAgentResource } from '../../hooks/agent/useAgentResource';
import { dateTime } from '../../utils/agent/rules';

export default function AgentEnquiriesScreen({ service, revision, onChanged }) {
  const resource = useAgentResource(() => service.loadEnquiries(), [service, revision]);
  const [filter, setFilter] = useState('all');
  const shown = resource.data?.filter((row) => filter === 'all' || (filter === 'answered' ? !!row.response?.trim() : !row.response?.trim()));
  return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <Text style={styles.heading}>Buyer enquiries</Text>
    <AgentButton title="Refresh enquiries" disabled={resource.loading} onPress={resource.refresh} />
    <View style={styles.row}>{['all', 'waiting', 'answered'].map((value) => <AgentButton
      key={value} title={value} primary={filter === value} onPress={() => setFilter(value)} />)}</View>
    <AgentLoadState resource={resource} empty="No enquiries for your assigned properties.">
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
    <Text style={styles.muted}>{enquiry.response?.trim() ? 'Answered' : 'Waiting for a response'} · {dateTime(enquiry.created_at)}</Text>
    <Text style={styles.text}>{enquiry.message}</Text>
    {enquiry.response ? <Text style={styles.text}>Saved response: {enquiry.response}</Text> : null}
    <AgentField label="Your response" multiline value={response} editable={!action.busy} onChangeText={setResponse} />
    <AgentMessage error>{action.error}</AgentMessage>
    <AgentButton title={action.busy ? 'Saving…' : 'Save response'} primary disabled={action.busy || !response.trim()}
      onPress={() => action.run(() => service.reply(enquiry, response), 'Response saved.')} />
  </AgentCard>;
}
