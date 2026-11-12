import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Property photo. Shows the image at `uri` (property_images.url) or, when a
// listing has no photo, the grey placeholder from the wireframe.
export default function Photo({ uri, height = 120, width, label = 'PHOTO', style }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={[{ height, width, backgroundColor: colors.placeholder }, style]}
      />
    );
  }
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
