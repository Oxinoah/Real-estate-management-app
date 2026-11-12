import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import TabBar, { BUYER_TABS } from '../components/TabBar';
import { colors } from '../theme';
import { supabase } from '../lib/supabase';

const SECTIONS = [
  { title: 'Rental applications', empty: 'You have not applied for any rental yet.' },
  { title: 'Viewing requests', empty: 'You have not requested any viewing yet.' },
];

const OFFER_STATUS = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };

// Buyer "My Activity" tab (component "Track My Activity"). Offers are read
// from Supabase; the other sections are empty for now.
export default function BuyerActivityScreen({ session, onTabChange }) {
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState(null);
  const [enquiries, setEnquiries] = useState(null);

  useEffect(() => {
    supabase
      .from('offers')
      .select('offer_id, amount, status, created_at, properties(title, location)')
      .eq('buyer_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setOffers(data);
      });

    supabase
      .from('enquiries')
      .select('enquiry_id, message, response, created_at, properties(title)')
      .eq('buyer_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEnquiries(data || []));
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.role}>Buyer</Text>
        <Text style={styles.title}>My Activity</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Offers</Text>
          {error ? (
            <Text style={styles.empty}>Could not load offers: {error}</Text>
          ) : !offers ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : offers.length === 0 ? (
            <Text style={styles.empty}>You have not made any offers yet.</Text>
          ) : (
            offers.map((o) => (
              <View key={o.offer_id} style={styles.offerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerTitle}>{o.properties?.title}</Text>
                  <Text style={styles.empty}>
                    {o.properties?.location} · {new Date(o.created_at).toLocaleDateString('en-GB')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.offerTitle}>€{Math.round(o.amount).toLocaleString('en-GB')}</Text>
                  <Text style={styles.empty}>{OFFER_STATUS[o.status] || o.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enquiries</Text>
          {!enquiries ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : enquiries.length === 0 ? (
            <Text style={styles.empty}>You have not sent any enquiries yet.</Text>
          ) : (
            enquiries.map((e) => (
              <View key={e.enquiry_id} style={[styles.offerRow, { flexDirection: 'column', gap: 3 }]}>
                <Text style={styles.offerTitle}>{e.properties?.title}</Text>
                <Text style={styles.empty}>“{e.message}”</Text>
                <Text style={styles.empty}>
                  {e.response ? `Answer: ${e.response}` : 'Waiting for an answer'}
                </Text>
              </View>
            ))
          )}
        </View>

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
  offerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  offerTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  empty: { fontSize: 12, color: colors.muted },
});
