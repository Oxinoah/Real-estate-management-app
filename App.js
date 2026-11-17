import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import BuyerHomeScreen from './src/screens/BuyerHomeScreen';
import SellerHomeScreen from './src/screens/SellerHomeScreen';
import AgentHomeScreen from './src/screens/AgentHomeScreen';
import { supabase } from './src/lib/supabase';

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
  const [signingUp, setSigningUp] = useState(false);

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
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
