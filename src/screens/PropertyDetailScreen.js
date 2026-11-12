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
 * Input: one property (same fields as the `properties` table).
 * Output: onBack(), onToggleFavourite(id). "Make offer" and "Enquire" save
 * to Supabase; the other buttons are not wired yet.
 */
export default function PropertyDetailScreen({ property, session, isFavourite, onToggleFavourite, onBack }) {
  const [notice, setNotice] = useState(null);
  const isRent = property.transaction_type === 'rent';

  const [offering, setOffering] = useState(false);
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [enquiring, setEnquiring] = useState(false);
  const [message, setMessage] = useState('');

  function comingSoon(action) {
    setNotice(`${action} are not available yet.`);
  }

  async function submitEnquiry() {
    if (!message.trim()) {
      setNotice('Write your question first.');
      return;
    }
    setSending(true);
    const { error } = await supabase
      .from('enquiries')
      .insert({ property_id: property.property_id, buyer_id: session.user.id, message: message.trim() });
    setSending(false);
    if (error) {
      setNotice(`Could not send your enquiry: ${error.message}`);
      return;
    }
    setEnquiring(false);
    setMessage('');
    setNotice('Enquiry sent. The answer will appear in My Activity.');
  }

  async function submitOffer() {
    const value = Number(amount.replace(/[\s,]/g, ''));
    if (!value || value <= 0) {
      setNotice('Enter a valid offer amount.');
      return;
    }
    setSending(true);
    const { error } = await supabase
      .from('offers')
      .insert({ property_id: property.property_id, buyer_id: session.user.id, amount: value });
    setSending(false);
    if (error) {
      setNotice(`Could not send your offer: ${error.message}`);
      return;
    }
    setOffering(false);
    setAmount('');
    setNotice('Offer sent. You can follow it in My Activity.');
  }

  return (
    <Screen>
      <ScrollView>
        <View>
          <Photo height={220} label="PHOTO (1/5)" />
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
          {[0, 1, 2, 3].map((i) => (
            <Photo key={i} width={52} height={40} label="" style={styles.thumb} />
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

          {enquiring ? (
            <View style={styles.offerBox}>
              <Text style={styles.label}>Your question</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                multiline
                placeholder="Ask the seller or agent about this property"
                value={message}
                onChangeText={setMessage}
              />
              <Pressable
                style={[styles.button, styles.buttonFilled, sending && { opacity: 0.6 }]}
                onPress={submitEnquiry}
                disabled={sending}
              >
                <Text style={[styles.buttonText, styles.buttonTextFilled]}>
                  {sending ? 'Sending…' : 'Send enquiry'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {offering ? (
            <View style={styles.offerBox}>
              <Text style={styles.label}>Your offer (€)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 470000"
                value={amount}
                onChangeText={setAmount}
              />
              <Pressable
                style={[styles.button, styles.buttonFilled, sending && { opacity: 0.6 }]}
                onPress={submitOffer}
                disabled={sending}
              >
                <Text style={[styles.buttonText, styles.buttonTextFilled]}>
                  {sending ? 'Sending…' : 'Send offer'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={styles.button}
          onPress={() => {
            setOffering(false);
            setEnquiring(true);
          }}
        >
          <Text style={styles.buttonText}>Enquire</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => comingSoon('Viewing requests')}>
          <Text style={styles.buttonText}>Request viewing</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonFilled]}
          onPress={() => (isRent ? comingSoon('Rental applications') : (setEnquiring(false), setOffering(true)))}
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
  body: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  price: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 8 },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 6,
  },
  description: { fontSize: 13, color: '#555', lineHeight: 20 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offerBox: { gap: 8 },
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
  buttonFilled: { backgroundColor: colors.text },
  buttonText: { fontSize: 11, fontWeight: '600', color: colors.text },
  buttonTextFilled: { color: '#fff' },
});
