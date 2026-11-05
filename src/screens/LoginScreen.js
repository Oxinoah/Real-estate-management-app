import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Login component (see Component Diagram: "Login"), laid out like the
 * Week 1 wireframe.
 * Input: email + password.
 * Database: supabase.auth.signInWithPassword, then a lookup in `profiles`
 *   to resolve the role (buyer / seller / agent) the app needs to route on.
 * Output: calls onLoggedIn({ user, role, fullName }) so the parent can show
 *   the right home screen.
 */
export default function LoginScreen({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin() {
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .single();

    setLoading(false);

    if (profileError || !profile) {
      setError('Logged in, but no profile row was found for this account.');
      return;
    }

    onLoggedIn({ user: data.user, role: profile.role, fullName: profile.full_name });
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>RE</Text>
          </View>
          <Text style={styles.title}>Real Estate App</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
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
            placeholder="Password"
            placeholderTextColor="#999"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          <Text style={styles.forgot}>Forgot password?</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Don't have an account? <Text style={styles.footerLink}>Sign up</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 28,
  },
  header: { alignItems: 'center', gap: 10, marginBottom: 36 },
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
  form: { gap: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1a1a1a',
  },
  forgot: { fontSize: 12, color: '#888', alignSelf: 'flex-end' },
  error: { color: '#c0392b', fontSize: 13, textAlign: 'center' },
  button: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  footer: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
  },
  footerLink: { color: '#1a1a1a', fontWeight: '600' },
});
