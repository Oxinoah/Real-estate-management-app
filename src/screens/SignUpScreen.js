import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { loadProfile } from '../lib/profile';

const ROLES = [
  { key: 'buyer', label: 'Buyer', hint: 'Browse, save favourites, make offers' },
  { key: 'seller', label: 'Seller', hint: 'List properties for sale or rent' },
  { key: 'agent', label: 'Agent', hint: 'Manage listings for sellers' },
];

/**
 * Sign up component, same layout as the Login screen.
 * Input: full name, email, password, role (buyer / seller / agent).
 * Database: supabase.auth.signUp with the name and role in `options.data`;
 *   the trigger in supabase/schema.sql creates the `profiles` row.
 * Output: onLoggedIn({ user, role, fullName }) when the project logs the user
 *   in straight away, otherwise a "confirm your email" message; onBack().
 */
export default function SignUpScreen({ onLoggedIn, onBack }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('buyer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Fill in your name, email and password.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('The password needs at least 6 characters.');
      return;
    }

    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), role } },
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    // Email confirmation switched on in Supabase: no session until confirmed.
    if (!data.session) {
      setLoading(false);
      setDone(true);
      return;
    }

    const session = await loadProfile(data.user);
    setLoading(false);
    if (!session) {
      setError('Account created, but no profile row was found. Run supabase/schema.sql first.');
      return;
    }
    onLoggedIn(session);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>RE</Text>
          </View>
          <Text style={styles.title}>Create an account</Text>
          <Text style={styles.subtitle}>Choose how you will use the app</Text>
        </View>

        {done ? (
          <View style={styles.form}>
            <Text style={styles.info}>
              Account created. Open the confirmation email sent to {email.trim()}, then log in.
            </Text>
            <Pressable style={styles.button} onPress={onBack}>
              <Text style={styles.buttonText}>Back to log in</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#999"
              autoComplete="name"
              value={fullName}
              onChangeText={setFullName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (6 characters minimum)"
              placeholderTextColor="#999"
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />

            <Text style={styles.label}>I am a</Text>
            {ROLES.map((r) => (
              <Pressable
                key={r.key}
                style={[styles.role, role === r.key && styles.roleActive]}
                onPress={() => setRole(r.key)}
                accessibilityState={{ selected: role === r.key }}
              >
                <Text style={[styles.roleTitle, role === r.key && styles.roleTextActive]}>{r.label}</Text>
                <Text style={[styles.roleHint, role === r.key && styles.roleTextActive]}>{r.hint}</Text>
              </Pressable>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={styles.button} onPress={handleSignUp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign up</Text>}
            </Pressable>
          </View>
        )}

        <Pressable onPress={onBack} style={styles.footerWrap}>
          <Text style={styles.footer}>
            Already have an account? <Text style={styles.footerLink}>Log in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 28,
  },
  header: { alignItems: 'center', gap: 10, marginBottom: 28 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#888' },
  form: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1a1a1a',
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#888',
    marginTop: 6,
  },
  role: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  roleActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  roleTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  roleHint: { fontSize: 12, color: '#888', marginTop: 2 },
  roleTextActive: { color: '#fff' },
  info: { fontSize: 14, color: '#1a1a1a', textAlign: 'center', lineHeight: 21 },
  error: { color: '#c0392b', fontSize: 13, textAlign: 'center' },
  button: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  footerWrap: { marginTop: 'auto', paddingTop: 24 },
  footer: { textAlign: 'center', fontSize: 12, color: '#888' },
  footerLink: { color: '#1a1a1a', fontWeight: '600' },
});
