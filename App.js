import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import BuyerHomeScreen from './src/screens/BuyerHomeScreen';
import SellerHomeScreen from './src/screens/SellerHomeScreen';
import AgentHomeScreen from './src/screens/AgentHomeScreen';
import { supabase } from './src/lib/supabase';

export default function App() {
  // { user, role: 'buyer' | 'seller' | 'agent', fullName }
  const [session, setSession] = useState(null);

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  if (!session) {
    return (
      <>
        <LoginScreen onLoggedIn={setSession} />
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
