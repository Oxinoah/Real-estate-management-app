import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import TabBar, { BUYER_TABS } from '../components/TabBar';
import { colors } from '../theme';

const SECTIONS = [
  { title: 'Offers', empty: 'You have not made any offers yet.' },
  { title: 'Rental applications', empty: 'You have not applied for any rental yet.' },
  { title: 'Enquiries', empty: 'You have not sent any enquiries yet.' },
  { title: 'Viewing requests', empty: 'You have not requested any viewing yet.' },
];

// Buyer "My Activity" tab (component "Track My Activity"). The sections are
// empty for now; Week 3 fills them from offers, rental_applications,
// enquiries and viewings.
export default function BuyerActivityScreen({ onTabChange }) {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.role}>Buyer</Text>
        <Text style={styles.title}>My Activity</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.empty}>{s.empty}</Text>
          </View>
        ))}
      </ScrollView>

      <TabBar tabs={BUYER_TABS} active="activity" onChange={onTabChange} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  role: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  body: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    gap: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  empty: { fontSize: 12, color: colors.muted },
});
