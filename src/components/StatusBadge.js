import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { statusLabel } from '../utils/format';

export default function StatusBadge({ status }) {
  return (
    <View style={[styles.badge, status === 'draft' && styles.draft]}>
      <Text style={styles.text}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  draft: { opacity: 0.5 },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.text,
  },
});
