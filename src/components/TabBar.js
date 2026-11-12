import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

export const BUYER_TABS = [
  { key: 'browse', label: 'Browse' },
  { key: 'favourites', label: 'Favourites' },
  { key: 'activity', label: 'My Activity' },
  { key: 'profile', label: 'Profile' },
];

// Bottom navigation bar (see wireframe).
export default function TabBar({ tabs, active, onChange }) {
  return (
    <View style={styles.bar}>
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          style={[styles.item, active === t.key && styles.itemActive]}
          onPress={() => onChange(t.key)}
        >
          <Text style={[styles.text, active === t.key && styles.textActive]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  item: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
  itemActive: { borderTopWidth: 2, borderTopColor: colors.text, marginTop: -1 },
  text: { fontSize: 10, color: '#999' },
  textActive: { color: colors.text, fontWeight: '700' },
});
