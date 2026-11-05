import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Placeholder — build out per Trello W3 "Buyer screens (browse properties)".
export default function BuyerHomeScreen({ session }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Buyer home — {session.fullName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 16 },
});
