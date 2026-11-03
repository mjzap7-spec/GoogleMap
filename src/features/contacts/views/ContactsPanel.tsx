import { Avatar } from '../../../shared/ui/Avatar';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { memo } from 'react';
import { ActivityIndicator, Pressable, FlatList, StyleSheet, Text, View } from 'react-native';
import type { Contact } from '../models/contact';
import type { ContactsState, ContactsViewModel } from '../viewmodels/ContactsViewModel';
import { colors } from '../../../shared/theme/colors';
export interface ContactsPanelProps {
  state: Readonly<ContactsState>;
  commands: Pick<
    ContactsViewModel,
    | 'selectMapUser'
    | 'closeMapUser'
    | 'requestSelectedUser'
    | 'openForm'
    | 'cancel'
    | 'setEmail'
    | 'sendRequest'
    | 'respond'
    | 'locateContact'
    | 'setShowNearby'
    | 'retryNearby'
    | 'openInbox'
    | 'closeInbox'
    | 'dismissEvent'
  > & { retry: () => void };
  listHeight?: number;
  fill?: boolean;
  onEdit: (contact: Contact) => void;
  onSelect: (contact: Contact) => void;
}
export const ContactsPanel = memo(function ContactsPanel({
  state,
  listHeight = 240,
  fill = false,
  commands,
  onEdit,
  onSelect,
}: ContactsPanelProps) {
  const { t } = useTranslation();

  return (
    <View style={fill ? { flex: 1, minHeight: 0 } : undefined}>
      <Pressable
        accessibilityRole="button"
        onPress={commands.openInbox}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.accent}>
          {t('Notifications')}
          {state.requests.length + state.events.length
            ? '(' + (state.requests.length + state.events.length) + ')'
            : ''}
        </Text>
      </Pressable>
      {state.loading && (
        <ActivityIndicator color={colors.accent} accessibilityLabel={t('Loading contacts')} />
      )}
      {!!state.loadError && (
        <>
          <Text style={styles.error}>{t(state.loadError)}</Text>
          <Pressable accessibilityRole="button" onPress={commands.retry} style={styles.action}>
            <Text style={styles.accent}>{t('Retry')}</Text>
          </Pressable>
        </>
      )}
      {!state.loading && !state.contacts.length && (
        <Text style={styles.muted}>{t('No contacts yet. Send a request to add someone.')}</Text>
      )}
      <FlatList
        style={fill ? { flex: 1 } : { maxHeight: listHeight }}
        data={state.contacts}
        keyExtractor={(contact) => contact.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        renderItem={({ item: contact }) => (
          <View style={styles.row}>
            <Avatar uri={contact.avatarUrl} name={contact.name} size={38} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Show {name} on map', { name: contact.name })}
              onPress={() => onSelect(contact)}
              disabled={!!state.actionId}
              accessibilityState={{
                disabled: !!state.actionId,
                busy: state.actionId === 'locate:' + contact.id,
              }}
              style={({ pressed }) => [
                { flex: 1, paddingVertical: 16, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Text style={styles.name} numberOfLines={1}>
                {contact.name}
              </Text>
            </Pressable>
            {state.actionId === 'locate:' + contact.id && (
              <ActivityIndicator color={colors.accent} size="small" />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Edit {name}', { name: contact.name })}
              onPress={() => onEdit(contact)}
              style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
            >
              <Text style={styles.accent}>{t('Edit')}</Text>
            </Pressable>
          </View>
        )}
      />
      <Pressable
        accessibilityRole="button"
        onPress={commands.openForm}
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
      >
        <Text style={styles.accent}>{t('+ New contact')}</Text>
      </Pressable>
    </View>
  );
});
const styles = StyleSheet.create({
  pressed: { opacity: 0.65, backgroundColor: '#BCB5FF12' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  initial: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 16 },
  accent: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  muted: { color: colors.muted, lineHeight: 22 },
  error: { color: '#ffb4be', lineHeight: 22 },
  action: { minHeight: 44, justifyContent: 'center' },
  edit: {
    borderRadius: 10,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
