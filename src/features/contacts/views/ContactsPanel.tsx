import type { PersonChat } from '../../chat/models/personChats';
import { InboxIcon } from '../../../shared/ui/ChatIcon';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, FlatList, StyleSheet, Text, View } from 'react-native';
import type { Contact } from '../models/contact';
import type { ContactsViewModel } from '../viewmodels/ContactsViewModel';
import type { ContactListState } from '../viewmodels/contactSelectors';
import { SearchField } from '../../../shared/ui/SearchField';
import { ListEmptyState } from '../../../shared/ui/ListEmptyState';
import { ContactsIcon } from '../../../shared/ui/ContactsIcon';
import { CollectionToolbar } from '../../../shared/ui/CollectionToolbar';
import { InlineRetry } from '../../../shared/ui/InlineRetry';
import { colors } from '../../../shared/theme/colors';
import { useContactRowActions } from './useContactRowActions';
import { ContactRow } from './ContactRow';

const contactKey = (contact: Contact) => contact.id;
export interface ContactsPanelProps {
  state: Readonly<ContactListState>;
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
  onCall: (contact: Contact) => void;
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
  onCall,
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
  const actions = useContactRowActions(state.contacts, onSelect, onEdit, onChat, onCall);
  const actionId = state.actionId;
  const renderContact = useCallback(
    ({ item }: { item: Contact }) => {
      const chat = item.peerId ? personChats.get(item.peerId) : undefined;
      return (
        <ContactRow
          id={item.id}
          name={item.name}
          avatarUrl={item.avatarUrl}
          unread={chat?.unread ?? 0}
          canChat={!!chat}
          canCall={!!item.peerId && !!item.requestId}
          locating={actionId === 'locate:' + item.id}
          disabled={!!actionId}
          card={fill}
          actions={actions}
        />
      );
    },
    [personChats, actionId, fill, actions],
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
      {fill && (
        <CollectionToolbar
          title={t('Your contacts')}
          count={filteredContacts.length}
          action={t('New contact')}
          onAction={commands.openForm}
        />
      )}
      {state.loading && (
        <ActivityIndicator color={colors.accent} accessibilityLabel={t('Loading contacts')} />
      )}
      {!!state.loadError && <InlineRetry message={state.loadError} onRetry={commands.retry} />}
      <FlatList
        style={fill ? { flex: 1 } : { maxHeight: listHeight, minHeight: 0, flexShrink: 1 }}
        data={filteredContacts}
        keyExtractor={contactKey}
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
        renderItem={renderContact}
      />
      {!fill && (
        <View style={styles.dropdownActions}>
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
            <Pressable accessibilityRole="button" onPress={commands.openForm} style={styles.add}>
              <Text style={styles.accent}>{t('+ New contact')}</Text>
            </Pressable>
          )}
        </View>
      )}
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
  accent: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  add: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
