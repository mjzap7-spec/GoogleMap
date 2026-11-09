import { Avatar } from '../../../shared/ui/Avatar';
import { UnreadBadge, chatButtonLabel } from '../../../shared/ui/UnreadBadge';
import type { PersonChat } from '../../chat/models/personChats';
import { ChatIcon, EditIcon, InboxIcon } from '../../../shared/ui/ChatIcon';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { memo, useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, FlatList, StyleSheet, Text, View } from 'react-native';
import type { Contact } from '../models/contact';
import type { ContactsState, ContactsViewModel } from '../viewmodels/ContactsViewModel';
import { SearchField } from '../../../shared/ui/SearchField';
import { ListEmptyState } from '../../../shared/ui/ListEmptyState';
import { ContactsIcon } from '../../../shared/ui/ContactsIcon';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
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
  personChats: ReadonlyMap<string, PersonChat>;
  fill?: boolean;
  onEdit: (contact: Contact) => void;
  onChat: (contact: Contact) => void;
  onShowAll?: () => void;
  onSelect: (contact: Contact) => void;
}
export const ContactsPanel = memo(function ContactsPanel({
  state,
  listHeight = 240,
  personChats,
  fill = false,
  commands,
  onEdit,
  onChat,
  onShowAll,
  onSelect,
}: ContactsPanelProps) {
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const unread =
    state.requests.filter((i) => !i.acknowledged).length +
    state.events.filter((i) => !i.acknowledged).length;
  const term = useDeferredValue(search.trim().toLocaleLowerCase());
  const filteredContacts = useMemo(
    () =>
      term
        ? state.contacts.filter((contact) => contact.name.toLocaleLowerCase().includes(term))
        : state.contacts,
    [state.contacts, term],
  );
  return (
    <View style={fill ? { flex: 1, minHeight: 0 } : { flexShrink: 1, minHeight: 0 }}>
      <View style={styles.topRow}>
        <View style={styles.search}>
          <SearchField
            accessibilityLabel={t('Search contacts')}
            placeholder={t('Search contacts')}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={commands.openInbox}
          accessibilityLabel={t('Inbox')}
          accessibilityValue={{ text: String(unread) }}
          style={({ pressed }) => [styles.inbox, pressed && styles.pressed]}
        >
          <InboxIcon />
          {!!unread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>
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
      <FlatList
        style={fill ? { flex: 1 } : { maxHeight: listHeight, minHeight: 0, flexShrink: 1 }}
        data={filteredContacts}
        keyExtractor={(contact) => contact.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={fill && !filteredContacts.length ? styles.emptyList : undefined}
        ListEmptyComponent={
          !state.loading && !state.loadError ? (
            <ListEmptyState
              icon={<ContactsIcon />}
              message={t(
                term ? 'No matching contacts.' : 'No contacts yet. Send a request to add someone.',
              )}
            />
          ) : undefined
        }
        renderItem={({ item: contact }) => {
          const chat = contact.peerId ? personChats.get(contact.peerId) : undefined;
          const count = chat?.unread ?? 0;
          const chatLabel = t('Chat with {name}', { name: contact.name });
          return (
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Show {name} on map', { name: contact.name })}
                onPress={() => onSelect(contact)}
                disabled={!!state.actionId}
                accessibilityState={{
                  disabled: !!state.actionId,
                  busy: state.actionId === 'locate:' + contact.id,
                }}
                style={({ pressed }) => [styles.person, pressed && styles.pressed]}
              >
                <View>
                  <Avatar uri={contact.avatarUrl} name={contact.name} size={40} />
                  <UnreadBadge count={count} />
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {contact.name}
                </Text>
                {state.actionId === 'locate:' + contact.id && (
                  <ActivityIndicator color={colors.accent} size="small" />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Edit {name}', { name: contact.name })}
                onPress={() => onEdit(contact)}
                style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
              >
                <EditIcon />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={chatButtonLabel(t, chatLabel, count)}
                disabled={!chat}
                accessibilityState={{ disabled: !chat }}
                onPress={() => onChat(contact)}
                style={({ pressed }) => [
                  styles.edit,
                  !chat && { opacity: 0.45 },
                  pressed && styles.pressed,
                ]}
              >
                <ChatIcon unread={count} />
              </Pressable>
            </View>
          );
        }}
      />
      <View style={onShowAll ? styles.dropdownActions : styles.fullActions}>
        {onShowAll && (
          <Pressable accessibilityRole="button" onPress={onShowAll} style={styles.showAll}>
            <Text style={styles.accent}>{t('Show all')}</Text>
          </Pressable>
        )}
        {onShowAll ? (
          <Pressable
            accessibilityRole="button"
            onPress={commands.openForm}
            style={({ pressed }) => [styles.add, styles.dropdownAdd, pressed && styles.pressed]}
          >
            <Text style={styles.accent}>{t('+ New contact')}</Text>
          </Pressable>
        ) : (
          <PrimaryButton label={t('+ New contact')} busy={false} onPress={commands.openForm} />
        )}
      </View>
    </View>
  );
});
const styles = StyleSheet.create({
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  inbox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: { position: 'relative', flex: 1 },
  dropdownActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 8 },
  fullActions: { marginTop: 12 },
  dropdownAdd: { flex: 1 },
  showAll: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.buttonText, fontSize: 10, fontWeight: '700' },
  pressed: { opacity: 0.65, backgroundColor: '#BCB5FF12' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  person: {
    flex: 1,
    minWidth: 0,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
  },
  name: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '500' },
  accent: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  muted: { color: colors.muted, lineHeight: 22 },
  error: { color: '#ffb4be', lineHeight: 22 },
  action: {
    minHeight: 44,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
