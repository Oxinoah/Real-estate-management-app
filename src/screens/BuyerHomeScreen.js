import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import Screen from '../components/Screen';
import { supabase } from '../lib/supabase';
import PropertyListScreen from './PropertyListScreen';
import PropertyDetailScreen from './PropertyDetailScreen';
import BuyerActivityScreen from './BuyerActivityScreen';
import BuyerProfileScreen from './BuyerProfileScreen';

// Buyer home: bottom tabs (Browse / Favourites / My Activity / Profile) and
// the property detail. Properties come from Supabase; favourites are kept in
// local state for now.
export default function BuyerHomeScreen({ session, onLogout }) {
  const [tab, setTab] = useState('browse');
  const [selected, setSelected] = useState(null);
  const [favourites, setFavourites] = useState([]);

  const [properties, setProperties] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from('properties')
      .select('*')
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setProperties(data);
      });
  }, []);

  if (!properties) {
    return (
      <Screen>
        <Text style={{ textAlign: 'center', marginTop: 80, color: '#777' }}>
          {error ? `Could not load properties: ${error}` : 'Loading properties…'}
        </Text>
      </Screen>
    );
  }

  const published = properties;

  function toggleFavourite(id) {
    setFavourites((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  if (selected) {
    return (
      <PropertyDetailScreen
        property={selected}
        session={session}
        isFavourite={favourites.includes(selected.property_id)}
        onToggleFavourite={toggleFavourite}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (tab === 'activity') {
    return <BuyerActivityScreen session={session} onTabChange={setTab} />;
  }

  if (tab === 'profile') {
    return <BuyerProfileScreen session={session} onTabChange={setTab} onLogout={onLogout} />;
  }

  if (tab === 'favourites') {
    return (
      <PropertyListScreen
        title="Favourites"
        emptyText="No favourites yet. Tap the heart on a property to save it."
        properties={published.filter((p) => favourites.includes(p.property_id))}
        favourites={favourites}
        onToggleFavourite={toggleFavourite}
        onOpen={setSelected}
        onLogout={onLogout}
        activeTab="favourites"
        onTabChange={setTab}
      />
    );
  }

  return (
    <PropertyListScreen
      properties={published}
      favourites={favourites}
      onToggleFavourite={toggleFavourite}
      onOpen={setSelected}
      onLogout={onLogout}
      activeTab="browse"
      onTabChange={setTab}
    />
  );
}
