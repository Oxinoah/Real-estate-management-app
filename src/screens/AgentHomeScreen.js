import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Screen from '../components/Screen';
import TabBar from '../components/TabBar';
import { colors } from '../theme';
import { supabase } from '../lib/supabase';
import { createAgentService } from '../services/agent/agentService';
import { AGENT_TABS, neighbours } from '../utils/agent/rules';
import { AgentMessage } from '../components/agent/AgentUI';
import AgentPropertyListScreen from './agent/AgentPropertyListScreen';
import AgentPropertyDetailScreen from './agent/AgentPropertyDetailScreen';
import AgentEnquiriesScreen from './agent/AgentEnquiriesScreen';
import AgentRequestsScreen from './agent/AgentRequestsScreen';
import AgentStatsScreen from './agent/AgentStatsScreen';

const SCOPES = [
  { key: 'mine', label: 'My properties' },
  { key: 'all', label: 'All properties' },
];

// Agent home: bottom tabs (Properties / Enquiries / Requests / Stats), the
// property screen, and a "My properties / All properties" switch that applies
// to every tab. Same layout as the Buyer and Seller homes.
// Several properties at once: the property screen remembers the list the
// agent came from (previous / next).
export default function AgentHomeScreen({ session, onLogout }) {
  const service = useMemo(() => createAgentService(supabase, session.user.id), [session.user.id]);
  const [tab, setTab] = useState('properties');
  const [scope, setScope] = useState('mine');
  const [propertyId, setPropertyId] = useState(null);
  const [browsing, setBrowsing] = useState([]); // ids of the list the property was opened from
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Nothing assigned yet: start on all properties so the lists are not empty.
    service.countAssigned().then((n) => {
      if (mounted.current && n === 0) setScope('all');
    }).catch(() => {});
    return () => { mounted.current = false; };
  }, [service]);

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

  const common = { service, scope, revision, onChanged: changed };
  let content;
  if (propertyId != null) {
    content = (
      <AgentPropertyDetailScreen
        key={propertyId}
        {...common}
        propertyId={propertyId}
        position={neighbours(browsing, propertyId)}
        onNavigate={(id) => { setNotice(null); setPropertyId(id); }}
        onBack={() => setPropertyId(null)}
      />
    );
  } else if (tab === 'properties') {
    content = (
      <AgentPropertyListScreen
        {...common}
        onOpen={(id, ids) => { setNotice(null); setBrowsing(ids); setPropertyId(id); }}
      />
    );
  } else if (tab === 'enquiries') {
    content = <AgentEnquiriesScreen {...common} />;
  } else if (tab === 'requests') {
    content = <AgentRequestsScreen {...common} />;
  } else {
    content = <AgentStatsScreen {...common} />;
  }

  return (
    <Screen>
      {propertyId == null ? (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.role}>Agent</Text>
              <Text style={styles.title}>{session.fullName || 'Agent workspace'}</Text>
            </View>
            <Pressable onPress={onLogout}>
              <Text style={styles.logout}>Log out</Text>
            </Pressable>
          </View>
          <View style={styles.chips}>
            {SCOPES.map((s) => (
              <Pressable
                key={s.key}
                style={[styles.chip, scope === s.key && styles.chipActive]}
                onPress={() => setScope(s.key)}
              >
                <Text style={[styles.chipText, scope === s.key && styles.chipTextActive]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <AgentMessage>{notice}</AgentMessage>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{content}</View>
      <TabBar
        tabs={AGENT_TABS}
        active={tab}
        onChange={(next) => changeTab(next)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  role: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  logout: { fontSize: 12, color: colors.muted },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 12, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
