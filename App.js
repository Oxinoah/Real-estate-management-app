import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import BuyerHomeScreen from './src/screens/BuyerHomeScreen';
import SellerHomeScreen from './src/screens/SellerHomeScreen';
import AgentHomeScreen from './src/screens/AgentHomeScreen';
import { supabase } from './src/lib/supabase';
import { loadProfile } from './src/lib/profile';

export default function App() {
  return (
    // Needed by the SafeAreaView in src/components/Screen.js (crashes on web without it).
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  // { user, role: 'buyer' | 'seller' | 'agent', fullName }
  const [session, setSession] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [signingUp, setSigningUp] = useState(false);

  // Supabase keeps the session on the phone (AsyncStorage): reopen the app
  // signed in instead of asking for the password every time.
  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data }) => {
        const restored = await loadProfile(data.session?.user);
        if (restored) setSession(restored);
      })
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  if (restoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color="#1a1a1a" />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        {signingUp ? (
          <SignUpScreen onLoggedIn={setSession} onBack={() => setSigningUp(false)} />
        ) : (
          <LoginScreen onLoggedIn={setSession} onSignUp={() => setSigningUp(true)} />
        )}
        <StatusBar style="auto" />
      </>
    );
  }

  const HomeByRole = {
    buyer: BuyerHomeScreen,
    seller: SellerHomeScreen,
    agent: AgentHomeScreen,
  }[session.role];

  return (
    <>
      <HomeByRole session={session} onLogout={logout} />
      <StatusBar style="auto" />
    </>
  );
}
