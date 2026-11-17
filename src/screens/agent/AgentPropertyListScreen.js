import React from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import Photo from '../../components/Photo';
import StatusBadge from '../../components/StatusBadge';
import { AgentLoadState, styles as ui } from '../../components/agent/AgentUI';
import { useAgentResource } from '../../hooks/agent/useAgentResource';
import { colors } from '../../theme';
import { formatPrice } from '../../utils/format';

// Agent "Properties" tab: the listings the agent manages, as cards like the
// Buyer list (photo, title, location, price, status).
export default function AgentPropertyListScreen({ service, scope, revision, onOpen }) {
  const resource = useAgentResource(() => service.loadPortfolio(scope), [service, scope, revision]);
  return (
    <ScrollView contentContainerStyle={styles.list}>
      <AgentLoadState
        resource={resource}
        empty={scope === 'mine'
          ? 'No property is assigned to you yet. Switch to "All properties" and open one to take it on.'
          : 'There are no properties yet.'}
      >
        {resource.data?.map((p) => (
          <Pressable key={p.property_id} style={styles.card} onPress={() => onOpen(p.property_id)}>
            <Photo uri={p.property_images?.[0]?.url} height={120} />
            <View style={styles.body}>
              <Text style={styles.cardTitle}>{p.title}</Text>
              <Text style={styles.meta}>
                {p.location} · {p.property_type}
              </Text>
              <Text style={styles.meta}>Seller: {p.seller?.full_name || '—'}</Text>
              <View style={styles.footer}>
                <Text style={styles.price}>{formatPrice(p)}</Text>
                <StatusBadge status={p.status} />
              </View>
            </View>
          </Pressable>
        ))}
      </AgentLoadState>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { ...ui.body, gap: 14 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  body: { paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  price: { fontSize: 14, fontWeight: '700', color: colors.text },
});
