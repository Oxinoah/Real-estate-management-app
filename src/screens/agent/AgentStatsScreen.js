import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AgentButton, AgentCard, AgentLoadState, AgentMessage, styles } from '../../components/agent/AgentUI';
import { useAgentResource } from '../../hooks/agent/useAgentResource';
import { dateTime, money } from '../../utils/agent/rules';

export default function AgentStatsScreen({ service, revision }) {
  const resource = useAgentResource(() => service.loadStats(), [service, revision]);
  const stats = resource.data;
  return <ScrollView contentContainerStyle={styles.body}>
    <Text style={styles.heading}>Portfolio statistics</Text>
    <AgentButton title="Refresh statistics" disabled={resource.loading} onPress={resource.refresh} />
    <AgentLoadState resource={resource}>
      {stats ? <>
        <AgentMessage>Only your assigned properties. “Per user” means per seller in this portfolio. All listing statuses are included in averages.</AgentMessage>
        <Text style={styles.muted}>Snapshot: {dateTime(stats.generated_at)}</Text>
        {stats.property_count === 0 ? <AgentMessage>Your portfolio is empty. There are no averages to calculate.</AgentMessage> : null}
        <AgentCard>
          <Text style={styles.heading}>Average sale price</Text>
          <Text style={styles.text}>{stats.sale.count ? money(stats.sale.average) : 'No sale listings'} · {stats.sale.count} listing(s)</Text>
          <Text style={styles.heading}>Average monthly rent</Text>
          <Text style={styles.text}>{stats.rent.count ? `${money(stats.rent.average)} / month` : 'No rental listings'} · {stats.rent.count} listing(s)</Text>
        </AgentCard>
        <AgentCard>
          <Text style={styles.heading}>Active listings per seller</Text>
          {stats.active_by_seller.map((seller) => <View style={styles.stack} key={seller.seller_id}>
            <Text style={styles.text}>{seller.full_name || seller.seller_id}: {seller.active_count}</Text>
            {seller.full_name ? <Text style={styles.muted}>{seller.seller_id}</Text> : null}
          </View>)}
        </AgentCard>
        <AgentCard>
          <Text style={styles.heading}>Purchase offers per property</Text>
          {stats.offers_by_property.map((property) => <Text style={styles.text} key={property.property_id}>
            {property.title}: {property.offer_count}{property.transaction_type === 'rent' ? ' (rental listing)' : ''}
          </Text>)}
        </AgentCard>
      </> : null}
    </AgentLoadState>
  </ScrollView>;
}
