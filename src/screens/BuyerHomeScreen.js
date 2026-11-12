import React, { useState } from 'react';
import PropertyListScreen from './PropertyListScreen';
import PropertyDetailScreen from './PropertyDetailScreen';
import { MOCK_PROPERTIES } from '../data/mockProperties';

// Buyer home: browse the list, open a property's detail. Favourites are kept
// in local state for now; Week 3 stores them in the `favourites` table.
export default function BuyerHomeScreen({ onLogout }) {
  const [selected, setSelected] = useState(null);
  const [favourites, setFavourites] = useState([]);

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

  return (
    <PropertyListScreen
      properties={MOCK_PROPERTIES.filter((p) => p.status !== 'draft')}
      favourites={favourites}
      onToggleFavourite={toggleFavourite}
      onOpen={setSelected}
      onLogout={onLogout}
    />
  );
}
