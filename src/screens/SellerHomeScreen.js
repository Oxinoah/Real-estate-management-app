import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Placeholder — build out per Trello W3 "Seller screens (property upload)".
export default function SellerHomeScreen({ session }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Seller home — {session.fullName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 16 },
});
