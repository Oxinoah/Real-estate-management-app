import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// Placeholder — build out per Trello W3 "Agent screens".
export default function AgentHomeScreen({ session, onLogout }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Agent home — {session.fullName}</Text>
      <Pressable onPress={onLogout}>
        <Text style={styles.logout}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#fff',
  },
  text: { fontSize: 16 },
  logout: { fontSize: 13, color: '#888' },
});
