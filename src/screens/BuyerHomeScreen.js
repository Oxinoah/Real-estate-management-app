import React, { useState } from 'react';
import PropertyListScreen from './PropertyListScreen';
import PropertyDetailScreen from './PropertyDetailScreen';
import BuyerActivityScreen from './BuyerActivityScreen';
import BuyerProfileScreen from './BuyerProfileScreen';
import { MOCK_PROPERTIES } from '../data/mockProperties';

// Buyer home: bottom tabs (Browse / Favourites / My Activity / Profile) and
// the property detail. Favourites are kept in local state for now; Week 3
// stores them in the `favourites` table.
export default function BuyerHomeScreen({ session, onLogout }) {
  const [tab, setTab] = useState('browse');
  const [selected, setSelected] = useState(null);
  const [favourites, setFavourites] = useState([]);

  const published = MOCK_PROPERTIES.filter((p) => p.status !== 'draft');

  function toggleFavourite(id) {
    setFavourites((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }

  if (selected) {
    return (
      <PropertyDetailScreen
        property={selected}
        isFavourite={favourites.includes(selected.property_id)}
        onToggleFavourite={toggleFavourite}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (tab === 'activity') {
    return <BuyerActivityScreen onTabChange={setTab} />;
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
