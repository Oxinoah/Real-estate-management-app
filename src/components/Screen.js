import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

// Full-screen container. On wide screens (web) the content stays in a
// phone-width column so the layout matches the wireframe.
export default function Screen({ children }) {
  return (
    <SafeAreaView style={styles.outer}>
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: colors.background },
});
