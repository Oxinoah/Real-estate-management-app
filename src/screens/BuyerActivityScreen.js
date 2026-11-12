import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import TabBar, { BUYER_TABS } from '../components/TabBar';
import { colors } from '../theme';
import { supabase } from '../lib/supabase';

const STATUS = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  requested: 'Requested',
  confirmed: 'Confirmed',
  declined: 'Declined',
};

const date = (value) => new Date(value).toLocaleDateString('en-GB');
const dateTime = (value) =>
  new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// What each section reads from Supabase and how a row is displayed.
const SECTIONS = [
  {
    key: 'offers',
    title: 'Offers',
    empty: 'You have not made any offers yet.',
    select: 'offer_id, amount, status, created_at, properties(title, location)',
    idField: 'offer_id',
    right: (r) => `€${Math.round(r.amount).toLocaleString('en-GB')}`,
    line: (r) => `${r.properties?.location} · ${date(r.created_at)}`,
  },
  {
    key: 'rental_applications',
    title: 'Rental applications',
    empty: 'You have not applied for any rental yet.',
    select: 'application_id, move_in_date, notes, status, created_at, properties(title, location)',
    idField: 'application_id',
    right: () => null,
    line: (r) => `Move-in ${date(r.move_in_date)} · sent ${date(r.created_at)}`,
  },
  {
    key: 'enquiries',
    title: 'Enquiries',
    empty: 'You have not sent any enquiries yet.',
    select: 'enquiry_id, message, response, created_at, properties(title)',
    idField: 'enquiry_id',
    right: () => null,
    status: (r) => (r.response ? 'Answered' : 'Waiting'),
    line: (r) => `“${r.message}”`,
    extra: (r) => (r.response ? `Answer: ${r.response}` : null),
  },
  {
    key: 'viewings',
    title: 'Viewing requests',
    empty: 'You have not requested any viewing yet.',
    select: 'viewing_id, requested_datetime, status, created_at, properties(title, location)',
    idField: 'viewing_id',
    right: () => null,
    line: (r) => dateTime(r.requested_datetime),
  },
];

// Buyer "My Activity" tab (component "Track My Activity"): everything the
// buyer has sent, read from Supabase, with its current status.
export default function BuyerActivityScreen({ session, onTabChange }) {
  const [data, setData] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    SECTIONS.forEach((s) => {
      supabase
        .from(s.key)
        .select(s.select)
        .eq('buyer_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(({ data: rows, error: err }) => {
          if (err) setError(err.message);
          else setData((current) => ({ ...current, [s.key]: rows }));
        });
    });
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.role}>Buyer</Text>
        <Text style={styles.title}>My Activity</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {error ? <Text style={styles.empty}>Could not load some activity: {error}</Text> : null}
        {SECTIONS.map((s) => {
          const rows = data[s.key];
          return (
            <View key={s.key} style={styles.card}>
              <Text style={styles.cardTitle}>{s.title}</Text>
              {!rows ? (
                <Text style={styles.empty}>Loading…</Text>
              ) : rows.length === 0 ? (
                <Text style={styles.empty}>{s.empty}</Text>
              ) : (
                rows.map((r) => (
                  <View key={r[s.idField]} style={styles.row}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.rowTitle}>{r.properties?.title}</Text>
                      <Text style={styles.empty}>{s.line(r)}</Text>
                      {s.extra && s.extra(r) ? <Text style={styles.empty}>{s.extra(r)}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      {s.right(r) ? <Text style={styles.rowTitle}>{s.right(r)}</Text> : null}
                      <Text style={styles.empty}>{s.status ? s.status(r) : STATUS[r.status] || r.status}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })}
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
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  empty: { fontSize: 12, color: colors.muted },
});
