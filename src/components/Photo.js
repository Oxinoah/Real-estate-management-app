import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Grey photo placeholder, as in the wireframe. Replaced by real images
// (property_images.url) once listings come from the database.
export default function Photo({ height = 120, width, label = 'PHOTO', style }) {
  return (
    <View style={[styles.box, { height, width }, style]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 11, color: colors.placeholderText },
});
