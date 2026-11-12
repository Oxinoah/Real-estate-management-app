import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import { colors } from '../theme';

const PROPERTY_TYPES = ['Apartment', 'House', 'Studio', 'Land'];

/**
 * GUI screen 3/3 — create-property form (Seller, "+ New Property").
 * Input: title, description, price, sale/rent, property type, location —
 *   the same fields as the `properties` table.
 * Output: onSubmit(property, status) with status 'draft' or 'active', and
 *   onCancel(). Saving to Supabase is wired in Week 3.
 */
export default function CreatePropertyScreen({ onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [transactionType, setTransactionType] = useState('sale');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [location, setLocation] = useState('');
  const [errors, setErrors] = useState([]);

  function submit(status) {
    const problems = [];
    const amount = Number(price.replace(',', '.'));

    if (!title.trim()) problems.push('Enter a title.');
    if (!location.trim()) problems.push('Enter a location.');
    if (!price.trim() || Number.isNaN(amount) || amount <= 0) {
      problems.push('Enter a price greater than 0.');
    }

    setErrors(problems);
    if (problems.length > 0) return;

    onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        price: amount,
        transaction_type: transactionType,
        property_type: propertyType,
        location: location.trim(),
      },
      status
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onCancel} accessibilityLabel="Cancel">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New Property</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Photos</Text>
        <View style={styles.photoBox}>
          <Text style={styles.photoText}>+ Add photos</Text>
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Bright 2-bedroom apartment"
          placeholderTextColor={colors.placeholderText}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Listing type</Text>
        <View style={styles.segmented}>
          {[
            { key: 'sale', label: 'For sale' },
            { key: 'rent', label: 'For rent' },
          ].map((o) => (
            <Pressable
              key={o.key}
              style={[styles.segment, transactionType === o.key && styles.segmentActive]}
              onPress={() => setTransactionType(o.key)}
            >
              <Text
                style={[styles.segmentText, transactionType === o.key && styles.segmentTextActive]}
              >
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>
          {transactionType === 'rent' ? 'Monthly rent (€)' : 'Price (€)'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={colors.placeholderText}
          keyboardType="numeric"
          value={price}
          onChangeText={setPrice}
        />

        <Text style={styles.label}>Property type</Text>
        <View style={styles.chips}>
          {PROPERTY_TYPES.map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, propertyType === t && styles.chipActive]}
              onPress={() => setPropertyType(t)}
            >
              <Text style={[styles.chipText, propertyType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          placeholder="City or neighbourhood"
          placeholderTextColor={colors.placeholderText}
          value={location}
          onChangeText={setLocation}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Rooms, condition, amenities..."
          placeholderTextColor={colors.placeholderText}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        {errors.map((e) => (
          <Text key={e} style={styles.error}>
            {e}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => submit('draft')}>
          <Text style={styles.buttonText}>Save as draft</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.buttonFilled]} onPress={() => submit('active')}>
          <Text style={[styles.buttonText, styles.buttonTextFilled]}>Publish</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  cancel: { fontSize: 13, color: colors.muted, width: 60 },
  headerSpacer: { width: 60 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  form: { paddingHorizontal: 20, paddingBottom: 20, gap: 6 },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 10,
  },
  photoBox: {
    height: 90,
    backgroundColor: colors.placeholder,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoText: { fontSize: 12, color: colors.placeholderText },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.text },
  segmentText: { fontSize: 13, color: colors.text },
  segmentTextActive: { color: '#fff', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 12, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  error: { color: colors.error, fontSize: 13, marginTop: 6 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  button: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonFilled: { backgroundColor: colors.text },
  buttonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  buttonTextFilled: { color: '#fff' },
});
