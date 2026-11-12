import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import StatusBadge from '../../components/StatusBadge';
import { AgentButton, AgentCard, AgentLoadState, styles } from '../../components/agent/AgentUI';
import { useAgentResource } from '../../hooks/agent/useAgentResource';
import { money } from '../../utils/agent/rules';

export default function AgentPropertyListScreen({ service, revision, onOpen }) {
  const resource = useAgentResource(() => service.loadPortfolio(), [service, revision]);
  return <ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.heading}>Assigned properties</Text>
    <AgentButton title="Refresh properties" disabled={resource.loading} onPress={resource.refresh} />
    <AgentLoadState resource={resource} empty="No properties are assigned to you.">
      {resource.data?.map((property) => <AgentCard key={property.property_id}>
        <Text style={styles.heading}>{property.title}</Text>
        <Text style={styles.text}>{property.location} · {property.property_type}</Text>
        <Text style={styles.text}>{money(property.price)}{property.transaction_type === 'rent' ? ' / month · For rent' : ' · For sale'}</Text>
        <View style={styles.row}><StatusBadge status={property.status} /></View>
        <AgentButton title="Open property" onPress={() => onOpen(property.property_id)} />
      </AgentCard>)}
    </AgentLoadState>
  </ScrollView>;
}
