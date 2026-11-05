import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Placeholder — build out per Trello W3 "Agent screens".
export default function AgentHomeScreen({ session }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Agent home — {session.fullName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 16 },
});
