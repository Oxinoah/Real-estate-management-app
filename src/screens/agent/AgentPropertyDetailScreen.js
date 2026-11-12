import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Photo from '../../components/Photo';
import StatusBadge from '../../components/StatusBadge';
import { AgentButton, AgentCard, AgentField, AgentLoadState, AgentMessage, styles } from '../../components/agent/AgentUI';
import { useAgentAction, useAgentResource } from '../../hooks/agent/useAgentResource';
import { canEditProperty, dateTime, money, propertyTransitions, validateProperty } from '../../utils/agent/rules';

export default function AgentPropertyDetailScreen({ service, propertyId, revision, onChanged, onBack }) {
  const resource = useAgentResource(() => service.loadProperty(propertyId), [service, propertyId, revision]);
  const action = useAgentAction(onChanged);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const result = resource.data;
  const property = result?.property;

  return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <View style={styles.row}>
      <AgentButton title="Back to portfolio" disabled={action.busy} onPress={onBack} />
      <AgentButton title="Refresh detail" disabled={action.busy || resource.loading || editing} onPress={() => {
        setConfirm(null);
        resource.refresh();
      }} />
    </View>
    <AgentLoadState resource={resource}>
      {property ? <>
        <AgentCard>
          <Text style={styles.title}>{property.title}</Text>
          <Text style={styles.text}>{property.location} · {property.property_type}</Text>
          <Text style={styles.text}>{money(property.price)}{property.transaction_type === 'rent' ? ' / month · For rent' : ' · For sale'}</Text>
          <View style={styles.row}><StatusBadge status={property.status} /></View>
          <Text style={styles.text}>{property.description || 'No description.'}</Text>
          <Text style={styles.muted}>Seller: {property.seller_id}</Text>
          {result.images.status === 'fulfilled' ? result.images.value.length ?
            result.images.value.map((image) => <Photo key={image.image_id} uri={image.url} height={180} />)
            : <Photo height={150} /> : <AgentMessage error>Photos could not be loaded. Other details remain available.</AgentMessage>}
        </AgentCard>
        {editing ? <PropertyEditor key={property.property_id} property={property} service={service}
          onCancel={() => setEditing(false)} onSaved={(message) => { setEditing(false); onChanged(message); }} /> : <>
          <AgentButton title="Edit listing" disabled={!canEditProperty(property) || action.busy} onPress={() => setEditing(true)} />
          {!canEditProperty(property) ? <AgentMessage>
            Content editing is locked from Under Offer onwards until protected fields are agreed by the team.
          </AgentMessage> : null}
          {propertyTransitions(property).map((transition) => <AgentButton key={transition.status}
            title={transition.label} disabled={action.busy} onPress={() => setConfirm(transition)} />)}
          {confirm ? <AgentCard>
            <Text style={styles.text}>Confirm: {confirm.label}? This changes the listing status and records its history.</Text>
            <AgentButton title={action.busy ? 'Saving…' : 'Confirm status change'} disabled={action.busy} primary
              onPress={async () => {
                if (await action.run(() => service.changeStatus(property, confirm.status), 'Listing status saved.')) setConfirm(null);
              }} />
            <AgentButton title="Cancel" disabled={action.busy} onPress={() => setConfirm(null)} />
          </AgentCard> : null}
          <AgentMessage>Under Offer is set by accepting a purchase offer. Rental completion is unavailable until its rules are agreed.</AgentMessage>
          <AgentMessage error>{action.error}</AgentMessage>
        </>}
        <AgentCard>
          <Text style={styles.heading}>Status history</Text>
          {result.history.status === 'rejected' ? <AgentMessage error>Status history is unavailable. Check permissions and refresh.</AgentMessage>
            : result.history.value.length === 0 ? <AgentMessage>No recorded status history.</AgentMessage>
              : result.history.value.map((entry) => <View style={styles.stack} key={entry.history_id}>
                <Text style={styles.text}>{entry.old_status || 'Created'} → {entry.new_status}</Text>
                <Text style={styles.muted}>{dateTime(entry.changed_at)} · {entry.changed_by}</Text>
              </View>)}
        </AgentCard>
      </> : null}
    </AgentLoadState>
  </ScrollView>;
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
    <AgentMessage>Owner and assignment cannot be changed here. Changing sale/rent is refused if offers or applications already exist.</AgentMessage>
    <AgentMessage error>{validation || action.error}</AgentMessage>
    <AgentButton title={action.busy ? 'Saving…' : 'Save listing'} primary disabled={action.busy} onPress={() => {
      const checked = validateProperty(values);
      setValidation(checked.errors.join(' ') || null);
      if (!checked.errors.length) action.run(() => service.updateProperty(property, checked.values), 'Listing saved.');
    }} />
    <AgentButton title="Cancel editing" disabled={action.busy} onPress={onCancel} />
  </AgentCard>;
}
