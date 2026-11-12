import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import Screen from '../components/Screen';
import TabBar from '../components/TabBar';
import { supabase } from '../lib/supabase';
import { createAgentService } from '../services/agent/agentService';
import { AGENT_TABS } from '../utils/agent/rules';
import { useAgentAction, useAgentResource } from '../hooks/agent/useAgentResource';
import { AgentButton, AgentLoadState, AgentMessage, styles } from '../components/agent/AgentUI';
import AgentPropertyListScreen from './agent/AgentPropertyListScreen';
import AgentPropertyDetailScreen from './agent/AgentPropertyDetailScreen';
import AgentEnquiriesScreen from './agent/AgentEnquiriesScreen';
import AgentDecisionsScreen from './agent/AgentDecisionsScreen';
import AgentStatsScreen from './agent/AgentStatsScreen';

// Keep the public entry point and props compatible with App.js.
export default function AgentHomeScreen({ session, onLogout }) {
  if (session?.role !== 'agent' || !session?.user?.id) {
    return <Screen><View style={styles.body}>
      <AgentMessage error>An authenticated Agent profile is required.</AgentMessage>
      <AgentButton title="Log out" onPress={onLogout} />
    </View></Screen>;
  }
  return <AgentWorkspace key={session.user.id} session={session} onLogout={onLogout} />;
}

function AgentWorkspace({ session, onLogout }) {
  const service = useMemo(() => createAgentService(supabase, session.user.id), [session.user.id]);
  const access = useAgentResource(() => service.readiness(), [service]);
  const logout = useAgentAction();
  const [tab, setTab] = useState('properties');
  const [propertyId, setPropertyId] = useState(null);
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

  const common = { service, revision, onChanged: changed };
  let content;
  if (propertyId != null) {
    content = <AgentPropertyDetailScreen {...common} propertyId={propertyId} onBack={() => setPropertyId(null)} />;
  } else if (tab === 'properties') {
    content = <AgentPropertyListScreen {...common} onOpen={setPropertyId} />;
  } else if (tab === 'enquiries') {
    content = <AgentEnquiriesScreen {...common} />;
  } else if (tab === 'stats') {
    content = <AgentStatsScreen {...common} />;
  } else {
    content = <AgentDecisionsScreen key={tab} {...common} kind={tab} />;
  }

  return <Screen>
    <View style={styles.header}>
      <Text style={styles.title}>Agent workspace</Text>
      <Text style={styles.muted}>{session.fullName || 'Agent'}</Text>
      <View style={styles.row}>
        <AgentButton title={logout.busy ? 'Logging out…' : 'Log out'} disabled={logout.busy}
          onPress={() => logout.run(onLogout, 'Signed out.')} />
        <AgentButton title="Refresh access" disabled={access.loading} onPress={access.refresh} />
      </View>
      <AgentMessage error>{logout.error}</AgentMessage>
      <AgentMessage>{notice}</AgentMessage>
    </View>
    <AgentLoadState resource={access}>{access.data ? content : null}</AgentLoadState>
    {access.error ? <View style={styles.body}><AgentMessage>
      Agent data and actions require the reviewed Agent database integration. No sample data is substituted.
    </AgentMessage></View> : null}
    {access.data ? <TabBar tabs={AGENT_TABS} active={tab} onChange={(next) => {
      setPropertyId(null);
      setNotice(null);
      setTab(next);
    }} /> : null}
  </Screen>;
}
