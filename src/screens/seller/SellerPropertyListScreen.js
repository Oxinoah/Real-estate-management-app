import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import Photo from '../../components/Photo';
import StatusBadge from '../../components/StatusBadge';
import { AgentLoadState, AgentMessage, styles as ui } from '../../components/agent/AgentUI';
import { useAgentResource } from '../../hooks/agent/useAgentResource';
import { colors } from '../../theme';
import { formatPrice, statusLabel } from '../../utils/format';
import { pendingCount } from '../../services/seller/sellerService';

const FILTERS = ['all', 'draft', 'active', 'under_offer', 'sold', 'rented'];

// Seller "Properties" tab ("My Properties" in the wireframe): the seller's
// own listings from Supabase, a status filter and the "+ New Property" button.
export default function SellerPropertyListScreen({ service, revision, onOpen, onCreate }) {
  const resource = useAgentResource(() => service.loadPortfolio(), [service, revision]);
  const [filter, setFilter] = useState('all');
  const all = resource.data || [];
  const shown = all.filter((p) => filter === 'all' || p.status === filter);

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Pressable style={styles.newButton} onPress={onCreate}>
        <Text style={styles.newButtonText}>+ New Property</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const count = f === 'all' ? all.length : all.filter((p) => p.status === f).length;
            return (
              <Pressable key={f} style={[styles.chip, filter === f && styles.chipActive]} onPress={() => setFilter(f)}>
                <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                  {f === 'all' ? 'All' : statusLabel(f)} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <AgentLoadState resource={resource} empty='You have no listings yet. Tap "+ New Property" to create one.'>
        {resource.data?.length && !shown.length ? <AgentMessage>No listing with this status.</AgentMessage> : null}
        {shown.map((p) => {
          const pending = pendingCount(p);
          return (
            <Pressable key={p.property_id} style={styles.row} onPress={() => onOpen(p.property_id)}>
              <Photo uri={p.property_images?.[0]?.url} width={96} height={96} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{p.title}</Text>
                <Text style={styles.rowMeta}>{p.location} · {formatPrice(p)}</Text>
                <View style={styles.rowFooter}>
                  <StatusBadge status={p.status} />
                  {pending ? <Text style={styles.pending}>{pending} to answer</Text> : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </AgentLoadState>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { ...ui.body, gap: 14 },
  newButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  newButtonText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 12, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rowBody: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 5 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 11, color: colors.muted },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pending: { fontSize: 11, fontWeight: '700', color: colors.text },
});
