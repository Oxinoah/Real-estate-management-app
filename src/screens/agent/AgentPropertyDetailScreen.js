import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet } from 'react-native';
import Photo from '../../components/Photo';
import StatusBadge from '../../components/StatusBadge';
import { AgentButton, AgentCard, AgentField, AgentLoadState, AgentMessage, styles } from '../../components/agent/AgentUI';
import { useAgentAction, useAgentResource } from '../../hooks/agent/useAgentResource';
import { colors } from '../../theme';
import { formatPrice, transactionLabel } from '../../utils/format';
import { canEditProperty, dateTime, propertyTransitions, validateProperty } from '../../utils/agent/rules';

// Agent property screen: photos, details, moderation (edit, change status),
// taking the listing on or releasing it, and the status history.
export default function AgentPropertyDetailScreen({ service, propertyId, revision, onChanged, onBack }) {
  const resource = useAgentResource(() => service.loadProperty(propertyId), [service, propertyId, revision]);
  const action = useAgentAction(onChanged);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [photo, setPhoto] = useState(0);
  const result = resource.data;
  const property = result?.property;
  const images = (result?.images || []).map((i) => i.url);
  const mine = property?.agent_id === service.agentId;

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
              <Text style={styles.muted}>Seller: {property.seller?.full_name || '—'}</Text>
              <Text style={styles.muted}>{mine ? 'Assigned to you' : property.agent_id ? 'Assigned to another agent' : 'Not assigned to an agent'}</Text>
            </View>

            {editing ? (
              <PropertyEditor key={property.property_id} property={property} service={service}
                onCancel={() => setEditing(false)} onSaved={(message) => { setEditing(false); onChanged(message); }} />
            ) : <>
              <AgentButton
                title={mine ? 'Release this property' : 'Assign to me'}
                disabled={action.busy}
                onPress={() => action.run(() => service.assign(property, !mine),
                  mine ? 'Property released.' : 'Property assigned to you.')}
              />
              <AgentButton title="Edit listing" disabled={!canEditProperty(property) || action.busy} onPress={() => setEditing(true)} />
              {!canEditProperty(property) ? <AgentMessage>
                The content cannot be edited once the property is under offer, sold or rented.
              </AgentMessage> : null}
              {propertyTransitions(property).map((transition) => (
                <AgentButton key={transition.status} title={transition.label} disabled={action.busy}
                  onPress={() => setConfirm(transition)} />
              ))}
              {confirm ? <AgentCard>
                <Text style={styles.text}>Confirm: {confirm.label}? The change is recorded in the status history.</Text>
                <AgentButton title={action.busy ? 'Saving…' : 'Confirm status change'} disabled={action.busy} primary
                  onPress={async () => {
                    if (await action.run(() => service.changeStatus(property, confirm.status), 'Listing status saved.')) setConfirm(null);
                  }} />
                <AgentButton title="Cancel" disabled={action.busy} onPress={() => setConfirm(null)} />
              </AgentCard> : null}
              <AgentMessage>"Under offer" is set automatically when you accept a purchase offer (Requests tab).</AgentMessage>
              <AgentMessage error>{action.error}</AgentMessage>
            </>}

            <AgentCard>
              <Text style={styles.heading}>Status history</Text>
              {result.history.length === 0 ? <AgentMessage>No recorded status history.</AgentMessage>
                : result.history.map((entry) => (
                  <View style={styles.stack} key={entry.history_id}>
                    <Text style={styles.text}>{entry.old_status || 'Created'} → {entry.new_status}</Text>
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

function PropertyEditor({ property, service, onSaved, onCancel }) {
  const [values, setValues] = useState(() => ({
    title: property.title, description: property.description || '', price: String(property.price),
    location: property.location, property_type: property.property_type, transaction_type: property.transaction_type,
  }));
  const [validation, setValidation] = useState(null);
  const action = useAgentAction(onSaved);
  function field(name, label, extras = {}) {
    return <AgentField label={label} value={values[name]} editable={!action.busy}
      onChangeText={(value) => setValues((current) => ({ ...current, [name]: value }))} {...extras} />;
  }
  return <AgentCard>
    <Text style={styles.heading}>Edit listing</Text>
    {field('title', 'Title')}
    {field('description', 'Description', { multiline: true })}
    {field('location', 'Location')}
    {field('property_type', 'Property type')}
    {field('price', values.transaction_type === 'rent' ? 'Monthly rent (€)' : 'Sale price (€)', { keyboardType: 'decimal-pad' })}
    <View style={styles.row}>{['sale', 'rent'].map((type) => <AgentButton key={type}
      title={type === 'sale' ? 'For sale' : 'For rent'} primary={values.transaction_type === type}
      disabled={action.busy} onPress={() => setValues((current) => ({ ...current, transaction_type: type }))} />)}</View>
    <AgentMessage error>{validation || action.error}</AgentMessage>
    <AgentButton title={action.busy ? 'Saving…' : 'Save listing'} primary disabled={action.busy} onPress={() => {
      const checked = validateProperty(values);
      setValidation(checked.errors.join(' ') || null);
      if (!checked.errors.length) action.run(() => service.updateProperty(property, checked.values), 'Listing saved.');
    }} />
    <AgentButton title="Cancel editing" disabled={action.busy} onPress={onCancel} />
  </AgentCard>;
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
