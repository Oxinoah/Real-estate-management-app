import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import Photo from '../components/Photo';
import StatusBadge from '../components/StatusBadge';
import CreatePropertyScreen from './CreatePropertyScreen';
import { MOCK_PROPERTIES } from '../data/mockProperties';
import { colors } from '../theme';

// Seller home ("My Properties" in the wireframe) with the "+ New Property"
// form. The list lives in local state for now; Week 3 reads and writes the
// `properties` table.
export default function SellerHomeScreen({ onLogout }) {
  const [creating, setCreating] = useState(false);
  const [properties, setProperties] = useState(MOCK_PROPERTIES.slice(0, 3));

  function addProperty(values, status) {
    const nextId = properties.reduce((max, p) => Math.max(max, p.property_id), 0) + 1;
    setProperties([{ property_id: nextId, status, ...values }, ...properties]);
    setCreating(false);
  }

  if (creating) {
    return <CreatePropertyScreen onSubmit={addProperty} onCancel={() => setCreating(false)} />;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.role}>Seller</Text>
          <Text style={styles.title}>My Properties</Text>
        </View>
        <Pressable onPress={onLogout}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      <Pressable style={styles.newButton} onPress={() => setCreating(true)}>
        <Text style={styles.newButtonText}>+ New Property</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.list}>
        {properties.map((p) => (
          <View key={p.property_id} style={styles.row}>
            <Photo width={96} height={96} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{p.title}</Text>
              <Text style={styles.rowMeta}>{p.location}</Text>
              <StatusBadge status={p.status} />
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.tabBar}>
        <Text style={[styles.tab, styles.tabActive]}>Properties</Text>
        <Text style={styles.tab}>Offers</Text>
        <Text style={styles.tab}>Profile</Text>
      </View>
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
    paddingBottom: 16,
  },
  role: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  logout: { fontSize: 12, color: colors.muted },
  newButton: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  newButtonText: { fontSize: 13, fontWeight: '600', color: colors.text },
  list: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
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
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tab: { flex: 1, textAlign: 'center', fontSize: 10, color: '#999' },
  tabActive: { color: colors.text, fontWeight: '700' },
});
