import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AgentButton, AgentCard, AgentLoadState, AgentMessage, styles } from '../../components/agent/AgentUI';
import { useAgentResource } from '../../hooks/agent/useAgentResource';
import { money } from '../../utils/agent/rules';

export default function AgentStatsScreen({ service, scope, revision }) {
  const resource = useAgentResource(() => service.loadStats(scope), [service, scope, revision]);
  const stats = resource.data;
  return <ScrollView contentContainerStyle={styles.body}>
    <AgentLoadState resource={resource}>
      {stats ? <>
        <AgentMessage>{scope === 'mine' ? 'Your assigned properties.' : 'All properties.'} “Per user” means per seller. All listing statuses are included in the averages.</AgentMessage>
        {stats.property_count === 0 ? <AgentMessage>No properties in this view, so there are no averages to calculate.</AgentMessage> : null}
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
