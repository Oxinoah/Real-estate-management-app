import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import Photo from '../components/Photo';
import TabBar, { BUYER_TABS } from '../components/TabBar';
import { colors } from '../theme';
import { formatPrice } from '../utils/format';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'sale', label: 'For sale' },
  { key: 'rent', label: 'For rent' },
];

/**
 * GUI screen 1/3 — property list (Buyer "Browse Properties", see wireframe).
 * Input: the list of properties + the buyer's favourite ids.
 * Output: onOpen(property) to show the detail, onToggleFavourite(id).
 */
export default function PropertyListScreen({
  properties,
  favourites,
  onToggleFavourite,
  onOpen,
  onLogout,
  title = 'Browse Properties',
  emptyText = 'No properties match your search.',
  activeTab = 'browse',
  onTabChange,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const q = query.trim().toLowerCase();
  const shown = properties.filter((p) => {
    const matchesText =
      !q || p.title.toLowerCase().includes(q) || p.location.toLowerCase().includes(q);
    const matchesType = filter === 'all' || p.transaction_type === filter;
    return matchesText && matchesType;
  });

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.role}>Buyer</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable onPress={onLogout}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      <View style={styles.controls}>
        <TextInput
          style={styles.search}
          placeholder="Search location or keyword"
          placeholderTextColor={colors.placeholderText}
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.chips}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {shown.length === 0 ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : (
          shown.map((p) => {
            const isFav = favourites.includes(p.property_id);
            return (
              <Pressable key={p.property_id} style={styles.card} onPress={() => onOpen(p)}>
                <Photo height={120} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  <Text style={styles.cardMeta}>
                    {p.location} · {p.property_type}
                  </Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.price}>{formatPrice(p)}</Text>
                    <Pressable
                      hitSlop={10}
                      onPress={() => onToggleFavourite(p.property_id)}
                      accessibilityLabel={isFav ? 'Remove from favourites' : 'Add to favourites'}
                    >
                      <Text style={[styles.heart, isFav && styles.heartActive]}>
                        {isFav ? '♥' : '♡'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <TabBar tabs={BUYER_TABS} active={activeTab} onChange={onTabChange} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  role: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  logout: { fontSize: 12, color: colors.muted },
  controls: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.text,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 12, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardBody: { paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.muted },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: { fontSize: 14, fontWeight: '700', color: colors.text },
  heart: { fontSize: 18, color: '#bbb' },
  heartActive: { color: colors.text },
});
