import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import Photo from '../../components/Photo';
import StatusBadge from '../../components/StatusBadge';
import { AgentButton, AgentCard, AgentLoadState, AgentMessage, styles } from '../../components/agent/AgentUI';
import { useAgentAction, useAgentResource } from '../../hooks/agent/useAgentResource';
import { colors } from '../../theme';
import { formatPrice, statusLabel, transactionLabel } from '../../utils/format';
import { canDeleteProperty, dateTime, propertyTransitions } from '../../utils/agent/rules';

// Seller property screen: photos, details, edit, delete, status changes
// (publish, withdraw, complete the sale / rental, deal fell through) and the
// status history. Requests on the listing are answered in the Requests tab.
export default function SellerPropertyDetailScreen({ service, propertyId, revision, onChanged, onEdit, onDeleted, onBack }) {
  const resource = useAgentResource(() => service.loadProperty(propertyId), [service, propertyId, revision]);
  const action = useAgentAction(onChanged);
  const [confirm, setConfirm] = useState(null); // a transition, or 'delete'
  const [photo, setPhoto] = useState(0);
  const result = resource.data;
  const property = result?.property;
  const images = (result?.images || []).map((i) => i.url);
  const final = property && ['sold', 'rented'].includes(property.status);

  async function confirmAction() {
    if (confirm === 'delete') {
      const done = await action.run(() => service.deleteProperty(property), 'Listing deleted.');
      if (done) onDeleted();
      return;
    }
    if (await action.run(() => service.changeStatus(property, confirm.status), 'Listing status saved.')) setConfirm(null);
  }

  return (
    <ScrollView contentContainerStyle={localStyles.page} keyboardShouldPersistTaps="handled">
      <View>
        <Photo uri={images[photo]} height={220} />
        <Pressable style={localStyles.back} onPress={onBack} accessibilityLabel="Back">
          <Text style={localStyles.backText}>←</Text>
        </Pressable>
      </View>
      {images.length > 1 ? (
        <View style={localStyles.thumbs}>
          {images.slice(0, 5).map((uri, i) => (
            <Pressable key={uri} onPress={() => setPhoto(i)}>
              <Photo uri={uri} width={52} height={40} style={[{ borderRadius: 4 }, photo === i && localStyles.thumbOn]} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.body}>
        <AgentLoadState resource={resource}>
          {property ? <>
            <View style={styles.stack}>
              <Text style={styles.title}>{property.title}</Text>
              <Text style={styles.muted}>
                {property.location} · {property.property_type} · {transactionLabel(property.transaction_type)}
              </Text>
              <Text style={localStyles.price}>{formatPrice(property)}</Text>
              <View style={styles.row}><StatusBadge status={property.status} /></View>
              <Text style={styles.text}>{property.description || 'No description.'}</Text>
              <Text style={styles.muted}>
                Agent: {property.agent?.full_name || 'none yet (an agent can take this listing on)'}
              </Text>
            </View>

            <AgentButton title="Edit listing" disabled={final || action.busy} onPress={() => onEdit(property, images)} />
            {property.status === 'under_offer' ? (
              <AgentMessage>Under offer: only the title, description and photos can still be changed.</AgentMessage>
            ) : null}
            {final ? <AgentMessage>This listing is {statusLabel(property.status).toLowerCase()}: it is closed and can no longer change.</AgentMessage> : null}

            {propertyTransitions(property).map((transition) => (
              <AgentButton key={transition.status} title={transition.label} disabled={action.busy}
                onPress={() => setConfirm(transition)} />
            ))}
            {property.status === 'active' ? (
              <AgentMessage>"Under offer" is set automatically when you accept an offer or a rental application (Requests tab).</AgentMessage>
            ) : null}
            {canDeleteProperty(property) ? (
              <AgentButton title="Delete listing" disabled={action.busy} onPress={() => setConfirm('delete')} />
            ) : null}

            {confirm ? <AgentCard>
              <Text style={styles.text}>
                {confirm === 'delete'
                  ? 'Delete this listing? Its photos, offers and requests are deleted too. This cannot be undone.'
                  : `Confirm: ${confirm.label}? The change is recorded in the status history.`}
              </Text>
              <AgentButton title={action.busy ? 'Saving…' : confirm === 'delete' ? 'Delete' : 'Confirm status change'}
                disabled={action.busy} primary onPress={confirmAction} />
              <AgentButton title="Cancel" disabled={action.busy} onPress={() => setConfirm(null)} />
            </AgentCard> : null}
            <AgentMessage error>{action.error}</AgentMessage>

            <AgentCard>
              <Text style={styles.heading}>Status history</Text>
              {result.history.length === 0 ? <AgentMessage>No recorded status history.</AgentMessage>
                : result.history.map((entry) => (
                  <View style={styles.stack} key={entry.history_id}>
                    <Text style={styles.text}>
                      {entry.old_status ? statusLabel(entry.old_status) : 'Created'} → {statusLabel(entry.new_status)}
                    </Text>
                    <Text style={styles.muted}>{dateTime(entry.changed_at)} · {entry.changer?.full_name || 'Unknown'}</Text>
                  </View>
                ))}
            </AgentCard>
          </> : null}
        </AgentLoadState>
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  page: { paddingBottom: 28 },
  back: {
    position: 'absolute', top: 16, left: 16, width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 14, color: colors.text },
  thumbs: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 10 },
  thumbOn: { borderWidth: 2, borderColor: colors.text },
  price: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 4 },
});
