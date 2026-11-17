import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import Photo from '../components/Photo';
import { colors } from '../theme';
import { isLocked } from '../utils/agent/rules';
import { SAMPLE_PHOTOS } from '../services/seller/sellerService';

const PROPERTY_TYPES = ['Apartment', 'House', 'Studio', 'Land'];

/**
 * GUI screen 3/3 — property form (Seller, "+ New Property" and "Edit").
 * Input: optional `property` (edit mode) with its `photos` urls.
 * Fields: title, description, price, sale/rent, property type, location,
 *   photos (sample photos, images can be mocked) — the `properties` table.
 * Output: onSubmit(values, status, photos) — a promise; status is 'draft'
 *   or 'active' for a new listing, null when editing. onCancel().
 * Once a property is under offer, price / type / location are locked.
 */
export default function CreatePropertyScreen({ property, photos: initialPhotos = [], onSubmit, onCancel }) {
  const editing = !!property;
  const [title, setTitle] = useState(property?.title || '');
  const [description, setDescription] = useState(property?.description || '');
  const [price, setPrice] = useState(property ? String(Number(property.price)) : '');
  const [transactionType, setTransactionType] = useState(property?.transaction_type || 'sale');
  const [propertyType, setPropertyType] = useState(property?.property_type || 'Apartment');
  const [location, setLocation] = useState(property?.location || '');
  const [photos, setPhotos] = useState(initialPhotos);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  const locked = (field) => editing && isLocked(property, field);
  const types = PROPERTY_TYPES.includes(propertyType) ? PROPERTY_TYPES : [...PROPERTY_TYPES, propertyType];

  function togglePhoto(url) {
    setPhotos((current) => (current.includes(url) ? current.filter((u) => u !== url) : [...current, url]));
  }

  async function submit(status) {
    const problems = [];
    const amount = Number(price.replace(/\s/g, '').replace(',', '.'));

    if (!title.trim()) problems.push('Enter a title.');
    if (!location.trim()) problems.push('Enter a location.');
    if (!price.trim() || Number.isNaN(amount) || amount <= 0) {
      problems.push('Enter a price greater than 0.');
    }

    setErrors(problems);
    if (problems.length > 0) return;

    setSaving(true);
    try {
      await onSubmit(
        {
          title: title.trim(),
          description: description.trim(),
          price: String(amount),
          transaction_type: transactionType,
          property_type: propertyType,
          location: location.trim(),
        },
        status,
        photos
      );
    } catch (error) {
      setErrors([error.message]);
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onCancel} accessibilityLabel="Cancel" disabled={saving}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{editing ? 'Edit Property' : 'New Property'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {editing && property.status === 'under_offer' ? (
          <Text style={styles.lockedNote}>
            This property is under offer: price, listing type, property type and location are locked.
          </Text>
        ) : null}

        <Text style={styles.label}>Photos ({photos.length} selected)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            {SAMPLE_PHOTOS.map((url) => {
              const on = photos.includes(url);
              return (
                <Pressable key={url} onPress={() => togglePhoto(url)} accessibilityLabel={on ? 'Remove photo' : 'Add photo'}>
                  <Photo uri={url} width={84} height={64} label="" style={[styles.photo, on && styles.photoOn]} />
                  {on ? <Text style={styles.photoTick}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <Text style={styles.hint}>Tap the sample photos to add them to the listing.</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Bright 2-bedroom apartment"
          placeholderTextColor={colors.placeholderText}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Listing type{locked('transaction_type') ? ' (locked)' : ''}</Text>
        <View style={[styles.segmented, locked('transaction_type') && styles.disabled]}>
          {[
            { key: 'sale', label: 'For sale' },
            { key: 'rent', label: 'For rent' },
          ].map((o) => (
            <Pressable
              key={o.key}
              disabled={locked('transaction_type')}
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
          {locked('price') ? ' (locked)' : ''}
        </Text>
        <TextInput
          style={[styles.input, locked('price') && styles.disabled]}
          placeholder="0"
          placeholderTextColor={colors.placeholderText}
          keyboardType="numeric"
          editable={!locked('price')}
          value={price}
          onChangeText={setPrice}
        />

        <Text style={styles.label}>Property type{locked('property_type') ? ' (locked)' : ''}</Text>
        <View style={[styles.chips, locked('property_type') && styles.disabled]}>
          {types.map((t) => (
            <Pressable
              key={t}
              disabled={locked('property_type')}
              style={[styles.chip, propertyType === t && styles.chipActive]}
              onPress={() => setPropertyType(t)}
            >
              <Text style={[styles.chipText, propertyType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Location{locked('location') ? ' (locked)' : ''}</Text>
        <TextInput
          style={[styles.input, locked('location') && styles.disabled]}
          placeholder="City or neighbourhood"
          placeholderTextColor={colors.placeholderText}
          editable={!locked('location')}
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
        {editing ? (
          <Pressable style={[styles.button, styles.buttonFilled, saving && styles.disabled]} disabled={saving}
            onPress={() => submit(null)}>
            <Text style={[styles.buttonText, styles.buttonTextFilled]}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={[styles.button, saving && styles.disabled]} disabled={saving} onPress={() => submit('draft')}>
              <Text style={styles.buttonText}>Save as draft</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonFilled, saving && styles.disabled]} disabled={saving}
              onPress={() => submit('active')}>
              <Text style={[styles.buttonText, styles.buttonTextFilled]}>{saving ? 'Saving…' : 'Publish'}</Text>
            </Pressable>
          </>
        )}
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
  photo: { borderRadius: 6, opacity: 0.55 },
  photoOn: { opacity: 1, borderWidth: 2, borderColor: colors.text },
  photoTick: {
    position: 'absolute',
    top: 4,
    right: 6,
    color: '#fff',
    fontWeight: '700',
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
  hint: { fontSize: 11, color: colors.muted },
  lockedNote: {
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.placeholder,
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  disabled: { opacity: 0.45 },
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
