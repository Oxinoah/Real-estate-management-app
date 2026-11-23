import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, TextInput, StyleSheet } from 'react-native';
import Photo from '../../components/Photo';
import StatusBadge from '../../components/StatusBadge';
import { AgentLoadState, AgentMessage, styles as ui } from '../../components/agent/AgentUI';
import { useAgentResource } from '../../hooks/agent/useAgentResource';
import { colors } from '../../theme';
import { formatPrice, statusLabel } from '../../utils/format';
import { filterPortfolio, pendingWork, portfolioSummary } from '../../utils/agent/rules';

const STATUSES = ['all', 'draft', 'active', 'under_offer', 'sold', 'rented'];
const SORTS = [
  { key: 'recent', label: 'Newest' },
  { key: 'attention', label: 'Needs an answer' },
];

// Agent "Properties" tab: every listing the agent manages ("My properties")
// or can take on ("All properties"), with a summary, a status filter, a
// search and the number of requests waiting on each listing.
// onOpen(id, ids) also passes the ids of the listed properties so the
// property screen can move to the previous / next one.
export default function AgentPropertyListScreen({ service, scope, revision, onOpen }) {
  const resource = useAgentResource(() => service.loadPortfolio(scope), [service, scope, revision]);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');

  const all = resource.data || [];
  const shown = filterPortfolio(all, { status, search, sort });
  const ids = shown.map((p) => p.property_id);
  const summary = portfolioSummary(all);

  return (
    <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      <AgentLoadState
        resource={resource}
        empty={scope === 'mine'
          ? 'No property is assigned to you yet. Switch to "All properties" and take some on.'
          : 'There are no properties yet.'}
      >
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {summary.count} propert{summary.count === 1 ? 'y' : 'ies'}
            {summary.waiting ? ` · ${summary.waiting} request${summary.waiting === 1 ? '' : 's'} to answer` : ' · nothing to answer'}
          </Text>
          <Text style={styles.summaryText}>
            {['active', 'under_offer', 'draft', 'sold', 'rented']
              .filter((s) => summary.byStatus[s])
              .map((s) => `${summary.byStatus[s]} ${statusLabel(s).toLowerCase()}`)
              .join(' · ')}
          </Text>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search title, location or seller"
          placeholderTextColor={colors.placeholderText}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search properties"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {STATUSES.map((s) => {
              const count = s === 'all' ? all.length : summary.byStatus[s];
              return (
                <Pressable key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
                  <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
                    {s === 'all' ? 'All' : statusLabel(s)} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.toolbar}>
          <View style={styles.chips}>
            {SORTS.map((o) => (
              <Pressable key={o.key} onPress={() => setSort(o.key)}>
                <Text style={[styles.sort, sort === o.key && styles.sortActive]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {!shown.length ? <AgentMessage>No property matches this search or filter.</AgentMessage> : null}
        {shown.map((p) => {
          const work = pendingWork(p);
          const owner = p.agent_id === service.agentId ? 'Yours' : p.agent_id ? 'Other agent' : 'Unassigned';
          return (
            <Pressable
              key={p.property_id}
              style={styles.card}
              onPress={() => onOpen(p.property_id, ids)}
            >
              <Photo uri={p.property_images?.[0]?.url} width={104} height={118} />
              <View style={styles.body}>
                <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.meta} numberOfLines={1}>{p.location} · {p.seller?.full_name || '—'}</Text>
                <Text style={styles.price}>{formatPrice(p)}</Text>
                <View style={styles.footer}>
                  <StatusBadge status={p.status} />
                  <Text style={styles.owner}>{owner}</Text>
                </View>
                {work.total ? (
                  <Text style={styles.work}>
                    {[
                      work.offers && `${work.offers} offer${work.offers > 1 ? 's' : ''}`,
                      work.applications && `${work.applications} application${work.applications > 1 ? 's' : ''}`,
                      work.viewings && `${work.viewings} viewing${work.viewings > 1 ? 's' : ''}`,
                      work.enquiries && `${work.enquiries} question${work.enquiries > 1 ? 's' : ''}`,
                    ].filter(Boolean).join(' · ')} to answer
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </AgentLoadState>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { ...ui.body, gap: 12 },
  summary: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, gap: 2 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  summaryText: { fontSize: 12, color: colors.muted },
  search: {
    borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 6,
    paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: colors.text,
  },
  chips: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 12, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sort: { fontSize: 12, color: colors.muted, paddingVertical: 4 },
  sortActive: { fontSize: 12, color: colors.text, fontWeight: '700', paddingVertical: 4 },
  card: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
  body: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, gap: 3 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  meta: { fontSize: 11, color: colors.muted },
  price: { fontSize: 13, fontWeight: '700', color: colors.text },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  owner: { fontSize: 11, color: colors.muted },
  work: { fontSize: 11, fontWeight: '700', color: colors.text },
});
