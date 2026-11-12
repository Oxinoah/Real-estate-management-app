import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme';

export function AgentButton({ title, onPress, disabled, primary = false }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primary, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{title}</Text>
    </Pressable>
  );
}

export function AgentMessage({ error, children }) {
  if (!children) return null;
  return <Text accessibilityLiveRegion="polite" style={[styles.message, error && styles.error]}>{children}</Text>;
}

export function AgentLoadState({ resource, empty, children }) {
  if (resource.loading) return <ActivityIndicator accessibilityLabel="Loading Agent data" color={colors.text} />;
  if (resource.error) return <AgentMessage error>{resource.error}</AgentMessage>;
  if (Array.isArray(resource.data) && resource.data.length === 0) return <AgentMessage>{empty}</AgentMessage>;
  return children;
}

export function AgentCard({ children }) {
  return <View style={styles.card}>{children}</View>;
}

export function AgentField({ label, ...props }) {
  return <View style={styles.stack}><Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.placeholderText} {...props}
      style={[styles.input, props.multiline && styles.multiline]} /></View>;
}

export const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, gap: 8 },
  body: { paddingHorizontal: 20, paddingVertical: 12, gap: 14, paddingBottom: 28 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 14, gap: 10 },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  heading: { fontSize: 15, fontWeight: '600', color: colors.text },
  text: { fontSize: 13, color: colors.text, lineHeight: 20 },
  muted: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 12, color: colors.text, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  stack: { gap: 6 },
  button: { borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  buttonText: { fontSize: 12, fontWeight: '600', color: colors.text },
  primary: { backgroundColor: colors.text },
  primaryText: { color: '#fff' },
  disabled: { opacity: 0.45 },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 6, padding: 11, color: colors.text, fontSize: 14 },
  multiline: { minHeight: 85, textAlignVertical: 'top' },
  message: { fontSize: 13, lineHeight: 20, color: colors.muted },
  error: { color: colors.error },
});
