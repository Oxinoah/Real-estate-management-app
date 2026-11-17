import React, { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import Screen from '../components/Screen';
import { supabase } from '../lib/supabase';
import PropertyListScreen from './PropertyListScreen';
import PropertyDetailScreen from './PropertyDetailScreen';
import BuyerActivityScreen from './BuyerActivityScreen';
import BuyerProfileScreen from './BuyerProfileScreen';

// Buyer home: bottom tabs (Browse / Favourites / My Activity / Profile) and
// the property detail. Properties and favourites are stored in Supabase.
export default function BuyerHomeScreen({ session, onLogout }) {
  const [tab, setTab] = useState('browse');
  const [selected, setSelected] = useState(null);
  const [favourites, setFavourites] = useState([]);

  const [properties, setProperties] = useState(null);
  const [error, setError] = useState(null);

  const [refreshing, setRefreshing] = useState(false);

  // Reads the published listings (with photos) from Supabase.
  const loadProperties = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('properties')
      .select('*, property_images(url)')
      .neq('status', 'draft')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else {
      setError(null);
      setProperties(data);
    }
  }, []);

  useEffect(() => {
    supabase
      .from('favourites')
      .select('property_id')
      .eq('buyer_id', session.user.id)
      .then(({ data }) => {
        if (data) setFavourites(data.map((f) => f.property_id));
      });
    loadProperties();
  }, []);

  // Pull to refresh on the lists: new listings and status changes appear.
  async function refresh() {
    setRefreshing(true);
    await loadProperties();
    setRefreshing(false);
  }

  function changeTab(next) {
    setTab(next);
    if (next === 'browse' || next === 'favourites') loadProperties();
  }

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

  // Update the screen right away, then save in Supabase (undo if it fails).
  async function toggleFavourite(id) {
    const wasFavourite = favourites.includes(id);
    setFavourites((current) =>
      wasFavourite ? current.filter((x) => x !== id) : [...current, id]
    );
    const query = supabase.from('favourites');
    const { error: err } = wasFavourite
      ? await query.delete().eq('buyer_id', session.user.id).eq('property_id', id)
      : await query.insert({ buyer_id: session.user.id, property_id: id });
    if (err) {
      setFavourites((current) =>
        wasFavourite ? [...current, id] : current.filter((x) => x !== id)
      );
    }
  }

  if (selected) {
    return (
      <PropertyDetailScreen
        property={selected}
        session={session}
        isFavourite={favourites.includes(selected.property_id)}
        onToggleFavourite={toggleFavourite}
        onBack={() => {
          setSelected(null);
          loadProperties();
        }}
      />
    );
  }

  if (tab === 'activity') {
    return <BuyerActivityScreen session={session} onTabChange={changeTab} />;
  }

  if (tab === 'profile') {
    return <BuyerProfileScreen session={session} onTabChange={changeTab} onLogout={onLogout} />;
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
        refreshing={refreshing}
        onRefresh={refresh}
        onTabChange={changeTab}
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
      refreshing={refreshing}
      onRefresh={refresh}
      onTabChange={changeTab}
    />
  );
}
