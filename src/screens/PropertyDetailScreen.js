import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import Photo from '../components/Photo';
import StatusBadge from '../components/StatusBadge';
import { colors } from '../theme';
import { formatPrice, transactionLabel } from '../utils/format';
import { supabase } from '../lib/supabase';

/**
 * GUI screen 2/3 — property detail (see wireframe "Property Detail").
 * Input: one property (same fields as the `properties` table) + the session.
 * Output: onBack(), onToggleFavourite(id). The three buttons save to Supabase:
 *   Enquire (enquiries), Request viewing (viewings), and
 *   Make offer (offers) for a sale / Apply to rent (rental_applications).
 */
export default function PropertyDetailScreen({ property, session, isFavourite, onToggleFavourite, onBack }) {
  const isRent = property.transaction_type === 'rent';
  const images = (property.property_images || []).map((i) => i.url);

  const [photo, setPhoto] = useState(0);
  const [mode, setMode] = useState(null); // 'enquiry' | 'viewing' | 'offer' | 'rental'
  const [notice, setNotice] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  function open(next) {
    setNotice(null);
    setMode(mode === next ? null : next);
  }

  // Validates the form of the open panel and returns [table, row] or null.
  function buildRow() {
    const base = { property_id: property.property_id, buyer_id: session.user.id };
    if (mode === 'enquiry') {
      if (!message.trim()) return fail('Write your question first.');
      return ['enquiries', { ...base, message: message.trim() }];
    }
    if (mode === 'offer') {
      const value = Number(amount.replace(/[\s,]/g, ''));
      if (!value || value <= 0) return fail('Enter a valid offer amount.');
      return ['offers', { ...base, amount: value }];
    }
    if (mode === 'rental') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date))) {
        return fail('Enter the move-in date as YYYY-MM-DD.');
      }
      if (new Date(date) < new Date(new Date().toDateString())) {
        return fail('The move-in date cannot be in the past.');
      }
      return ['rental_applications', { ...base, move_in_date: date, notes: notes.trim() || null }];
    }
    if (mode === 'viewing') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) {
        return fail('Enter the date as YYYY-MM-DD and the time as HH:MM.');
      }
      const when = new Date(`${date}T${time.padStart(5, '0')}`);
      if (isNaN(when) || when < new Date()) return fail('Choose a date and time in the future.');
      return ['viewings', { ...base, requested_datetime: when.toISOString(), created_by: session.user.id }];
    }
    return null;
  }

  function fail(text) {
    setNotice(text);
    return null;
  }

  const SUCCESS = {
    enquiry: 'Enquiry sent. The answer will appear in My Activity.',
    offer: 'Offer sent. You can follow it in My Activity.',
    rental: 'Application sent. You can follow it in My Activity.',
    viewing: 'Viewing request sent. You can follow it in My Activity.',
  };

  async function submit() {
    const built = buildRow();
    if (!built) return;
    setSending(true);
    const { error } = await supabase.from(built[0]).insert(built[1]);
    setSending(false);
    if (error) {
      setNotice(`Could not send: ${error.message}`);
      return;
    }
    setNotice(SUCCESS[mode]);
    setMode(null);
    setMessage('');
    setAmount('');
    setDate('');
    setTime('');
    setNotes('');
  }

  const field = (label, props) => (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.placeholderText} {...props} />
    </View>
  );

  return (
    <Screen>
      <ScrollView>
        <View>
          <Photo uri={images[photo]} height={220} label="PHOTO" />
          <Pressable style={[styles.roundButton, styles.left]} onPress={onBack} accessibilityLabel="Back">
            <Text style={styles.roundText}>←</Text>
          </Pressable>
          <Pressable
            style={[styles.roundButton, styles.right]}
            onPress={() => onToggleFavourite(property.property_id)}
            accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Text style={styles.roundText}>{isFavourite ? '♥' : '♡'}</Text>
          </Pressable>
        </View>

        <View style={styles.thumbs}>
          {(images.length ? images : [null, null, null, null]).slice(0, 5).map((uri, i) => (
            <Pressable key={i} onPress={() => setPhoto(i)}>
              <Photo
                uri={uri}
                width={52}
                height={40}
                label=""
                style={[styles.thumb, photo === i && uri ? styles.thumbActive : null]}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.body}>
          <View>
            <Text style={styles.title}>{property.title}</Text>
            <Text style={styles.meta}>
              {property.location} · {property.property_type} · {transactionLabel(property.transaction_type)}
            </Text>
            <Text style={styles.price}>{formatPrice(property)}</Text>
          </View>

          <View>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.description}>{property.description}</Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.label}>Status</Text>
            <StatusBadge status={property.status} />
          </View>

          {mode ? (
            <View style={styles.panel}>
              {mode === 'enquiry'
                ? field('Your question', {
                    multiline: true,
                    placeholder: 'Ask the seller or agent about this property',
                    value: message,
                    onChangeText: setMessage,
                    style: [styles.input, { minHeight: 80, textAlignVertical: 'top' }],
                  })
                : null}
              {mode === 'offer'
                ? field('Your offer (€)', {
                    keyboardType: 'numeric',
                    placeholder: 'e.g. 470000',
                    value: amount,
                    onChangeText: setAmount,
                  })
                : null}
              {mode === 'rental' ? (
                <>
                  {field('Move-in date', { placeholder: 'YYYY-MM-DD', value: date, onChangeText: setDate })}
                  {field('Notes (optional)', {
                    multiline: true,
                    placeholder: 'Anything the owner should know',
                    value: notes,
                    onChangeText: setNotes,
                    style: [styles.input, { minHeight: 60, textAlignVertical: 'top' }],
                  })}
                </>
              ) : null}
              {mode === 'viewing' ? (
                <>
                  {field('Date', { placeholder: 'YYYY-MM-DD', value: date, onChangeText: setDate })}
                  {field('Time', { placeholder: 'HH:MM (e.g. 14:30)', value: time, onChangeText: setTime })}
                </>
              ) : null}
              <Pressable
                style={[styles.button, styles.buttonFilled, sending && { opacity: 0.6 }]}
                onPress={submit}
                disabled={sending}
              >
                <Text style={[styles.buttonText, styles.buttonTextFilled]}>
                  {sending ? 'Sending…' : 'Send'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={[styles.button, mode === 'enquiry' && styles.buttonOn]} onPress={() => open('enquiry')}>
          <Text style={styles.buttonText}>Enquire</Text>
        </Pressable>
        <Pressable style={[styles.button, mode === 'viewing' && styles.buttonOn]} onPress={() => open('viewing')}>
          <Text style={styles.buttonText}>Request viewing</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonFilled]}
          onPress={() => open(isRent ? 'rental' : 'offer')}
        >
          <Text style={[styles.buttonText, styles.buttonTextFilled]}>
            {isRent ? 'Apply to rent' : 'Make offer'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  roundButton: {
    position: 'absolute',
    top: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  left: { left: 16 },
  right: { right: 16 },
  roundText: { fontSize: 14, color: colors.text },
  thumbs: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 10 },
  thumb: { borderRadius: 4 },
  thumbActive: { borderWidth: 2, borderColor: colors.text },
  body: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  price: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 8 },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  description: { fontSize: 13, color: '#555', lineHeight: 20, marginTop: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  panel: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
  },
  notice: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: 8,
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
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonOn: { backgroundColor: colors.divider },
  buttonFilled: { backgroundColor: colors.text },
  buttonText: { fontSize: 11, fontWeight: '600', color: colors.text },
  buttonTextFilled: { color: '#fff' },
});
