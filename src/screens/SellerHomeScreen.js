import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import TabBar from '../components/TabBar';
import { colors } from '../theme';
import { supabase } from '../lib/supabase';
import { createSellerService } from '../services/seller/sellerService';
import { AgentMessage } from '../components/agent/AgentUI';
import CreatePropertyScreen from './CreatePropertyScreen';
import BuyerProfileScreen from './BuyerProfileScreen';
import SellerPropertyListScreen from './seller/SellerPropertyListScreen';
import SellerPropertyDetailScreen from './seller/SellerPropertyDetailScreen';
import AgentRequestsScreen from './agent/AgentRequestsScreen';
import AgentEnquiriesScreen from './agent/AgentEnquiriesScreen';

export const SELLER_TABS = [
  { key: 'properties', label: 'Properties' },
  { key: 'requests', label: 'Requests' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'profile', label: 'Profile' },
];

// Seller home: bottom tabs (Properties / Requests / Enquiries / Profile), the
// property screen and the create / edit form. Everything is read from and
// saved to Supabase. The Requests and Enquiries screens are shared with the
// Agent (same functions in sellerService and agentService).
export default function SellerHomeScreen({ session, onLogout }) {
  const service = useMemo(() => createSellerService(supabase, session.user.id), [session.user.id]);
  const [tab, setTab] = useState('properties');
  const [propertyId, setPropertyId] = useState(null);
  const [form, setForm] = useState(null); // { property, photos } when editing, {} when creating
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function changed(message) {
    if (mounted.current) {
      setNotice(message);
      setRevision((value) => value + 1);
    }
  }

  function changeTab(next) {
    setPropertyId(null);
    setNotice(null);
    setTab(next);
  }

  if (form) {
    return (
      <CreatePropertyScreen
        property={form.property}
        photos={form.photos}
        onCancel={() => setForm(null)}
        onSubmit={async (values, status, photos) => {
          if (form.property) {
            await service.updateProperty(form.property, values, photos);
            changed('Listing saved.');
          } else {
            const created = await service.createProperty(values, status, photos);
            changed(status === 'active' ? 'Listing published.' : 'Draft saved.');
            setPropertyId(created.property_id);
          }
          setForm(null);
        }}
      />
    );
  }

  if (tab === 'profile') {
    return (
      <BuyerProfileScreen session={session} onLogout={onLogout} onTabChange={changeTab}
        roleLabel="Seller" tabs={SELLER_TABS} />
    );
  }

  const common = { service, scope: 'mine', revision, onChanged: changed };
  let content;
  if (propertyId != null) {
    content = (
      <SellerPropertyDetailScreen
        {...common}
        propertyId={propertyId}
        onBack={() => { setNotice(null); setPropertyId(null); }}
        onEdit={(property, photos) => setForm({ property, photos })}
        onDeleted={() => setPropertyId(null)}
      />
    );
  } else if (tab === 'requests') {
    content = <AgentRequestsScreen {...common} />;
  } else if (tab === 'enquiries') {
    content = <AgentEnquiriesScreen {...common} />;
  } else {
    content = (
      <SellerPropertyListScreen {...common} onOpen={setPropertyId} onCreate={() => { setNotice(null); setForm({}); }} />
    );
  }

  return (
    <Screen>
      {propertyId == null ? (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.role}>Seller</Text>
              <Text style={styles.title}>
                {{ properties: 'My Properties', requests: 'Offers & Requests', enquiries: 'Enquiries' }[tab]}
              </Text>
            </View>
            <Pressable onPress={onLogout}>
              <Text style={styles.logout}>Log out</Text>
            </Pressable>
          </View>
          <AgentMessage>{notice}</AgentMessage>
        </View>
      ) : notice ? (
        <View style={styles.noticeBar}><AgentMessage>{notice}</AgentMessage></View>
      ) : null}
      <View style={{ flex: 1 }}>{content}</View>
      <TabBar tabs={SELLER_TABS} active={tab} onChange={changeTab} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  role: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  logout: { fontSize: 12, color: colors.muted },
  noticeBar: { paddingHorizontal: 20, paddingTop: 10 },
});
