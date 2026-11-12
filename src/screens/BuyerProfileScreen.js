import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import TabBar, { BUYER_TABS } from '../components/TabBar';
import { colors } from '../theme';

// Buyer "Profile" tab: who is signed in, and log out.
export default function BuyerProfileScreen({ session, onTabChange, onLogout }) {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.role}>Buyer</Text>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{session.fullName || '—'}</Text>
          <Text style={[styles.label, styles.gap]}>Email</Text>
          <Text style={styles.value}>{session.user?.email || '—'}</Text>
          <Text style={[styles.label, styles.gap]}>Role</Text>
          <Text style={styles.value}>Buyer</Text>
        </View>

        <Pressable style={styles.button} onPress={onLogout}>
          <Text style={styles.buttonText}>Log out</Text>
        </Pressable>
      </View>

      <TabBar tabs={BUYER_TABS} active="profile" onChange={onTabChange} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  role: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  body: { flex: 1, paddingHorizontal: 20, gap: 20 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
  },
  label: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  gap: { marginTop: 14 },
  value: { fontSize: 15, color: colors.text, marginTop: 4 },
  button: {
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '600', color: colors.text },
});
