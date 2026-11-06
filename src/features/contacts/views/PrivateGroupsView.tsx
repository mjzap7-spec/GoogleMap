import React, { useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SectionList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { FormField } from '../../../shared/ui/FormField';
import { TextField } from '../../../shared/ui/TextField';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
import { Avatar } from '../../../shared/ui/Avatar';
import { GroupRowHeader } from './GroupRowHeader';
import type { MemberConversation } from '../../chat/models/conversations';
import { threadKey } from '../../chat/models/chat';
import { ChatIcon } from '../../../shared/ui/ChatIcon';
import { chatButtonLabel } from '../../../shared/ui/UnreadBadge';
import { Feedback } from '../../../shared/ui/Feedback';
import type { Contact } from '../models/contact';
import { groupList, groupSections, type GroupLocation } from '../models/sharing';
import type { SharingState, SharingViewModel } from '../viewmodels/SharingViewModel';
type Commands = Pick<
  SharingViewModel,
  | 'setName'
  | 'create'
  | 'join'
  | 'leave'
  | 'invite'
  | 'selectGroup'
  | 'startTrip'
  | 'stopTrip'
  | 'start'
>;
export function PrivateGroupsView({
  state,
  commands,
  contacts,
  userId,
  onLocate,
  members,
  unreadChats,
  onChat,
  rosterError,
  retryRoster,
}: {
  state: Readonly<SharingState>;
  commands: Commands;
  contacts: readonly Contact[];
  userId: string;
  onLocate: (location: GroupLocation) => void;
  members: MemberConversation[];
  unreadChats: ReadonlyMap<string, number>;
  onChat: (group: string, member?: string) => void;
  rosterError: boolean;
  retryRoster: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const filter = useDeferredValue(search);
  const sections = useMemo(
    () =>
      state.membershipsLoaded
        ? groupSections(groupList(state.groups, state.directory, filter), userId)
        : [],
    [state.membershipsLoaded, state.groups, state.directory, filter, userId],
  );
  if (creating) {
    const save = async () => {
      if (!state.name.trim() || state.busy) return;
      if (await commands.create()) setCreating(false);
    };
    return (
      <>
        <Feedback source="groups" error={state.error} />
        <ScrollView
          key="create"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
        >
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.name}>
              {t('Create private group')}
            </Text>
            <Text style={styles.hint}>
              {t(
                'Signed-in users can find and join this group. Only members can read its chat and shared locations.',
              )}
            </Text>
            <FormField
              label={t('Group name')}
              placeholder={t('Family or friends')}
              value={state.name}
              onChangeText={commands.setName}
              autoFocus
              maxLength={60}
              editable={!state.busy}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <PrimaryButton
              label={t('Save')}
              busy={state.action === 'create'}
              disabled={state.busy || !state.name.trim()}
              onPress={save}
            />
            <Pressable
              accessibilityRole="button"
              disabled={state.busy}
              style={styles.button}
              onPress={() => setCreating(false)}
            >
              <Text style={styles.action}>{t('Cancel')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </>
    );
  }
  return (
    <>
      <Feedback source="groups" error={state.error} />
      <TextField
        accessibilityLabel={t('Search groups')}
        placeholder={t('Search groups')}
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        returnKeyType="search"
      />
      <SectionList
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        sections={sections}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {t(section.title)}
            </Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        keyExtractor={(g) => g.id}
        ListEmptyComponent={
          state.error ? undefined : !state.membershipsLoaded || !state.directoryLoaded ? (
            <ActivityIndicator style={styles.empty} color={colors.accent} />
          ) : (
            <Text style={[styles.hint, styles.empty]}>
              {t(filter.trim() ? 'No matching groups.' : 'No private groups yet.')}
            </Text>
          )
        }
        renderItem={({ item: group }) => {
          const membership = 'joinedIds' in group ? group : undefined;
          const joined = membership?.joinedIds.includes(userId) ?? false;
          const selected = joined && state.selectedId === group.id;
          const roomUnread = unreadChats.get(threadKey({ groupId: group.id })) ?? 0;
          return (
            <View style={[styles.card, styles.groupCard, selected && styles.selected]}>
              <GroupRowHeader
                group={group}
                expanded={selected}
                onToggle={
                  joined
                    ? () => {
                        setConfirming('');
                        commands.selectGroup(selected ? '' : group.id);
                      }
                    : undefined
                }
                onJoin={joined ? undefined : () => commands.join(group)}
                joining={state.action === 'join:' + group.id}
                disabled={state.busy}
              />
              {membership && !joined && (
                <Pressable
                  accessibilityRole="button"
                  disabled={state.busy}
                  onPress={() => commands.leave(membership)}
                  style={styles.button}
                >
                  <Text style={styles.hint}>{t('Decline')}</Text>
                </Pressable>
              )}
              {selected && membership && (
                <>
                  <View style={styles.member}>
                    <Text style={[styles.name, styles.identity]}>{t('Members')}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={chatButtonLabel(
                        t,
                        t('Open group chat: {name}', { name: group.name }),
                        roomUnread,
                      )}
                      onPress={() => onChat(group.id)}
                      style={[styles.button, styles.groupChatButton]}
                    >
                      <Text style={styles.action}>{t('Group chat')}</Text>
                      <ChatIcon unread={roomUnread} />
                    </Pressable>
                  </View>
                  {rosterError && (
                    <Pressable accessibilityRole="button" onPress={retryRoster}>
                      <Text style={styles.hint}>
                        {t('Could not load group members.')} · {t('Retry')}
                      </Text>
                    </Pressable>
                  )}
                  {members.map((person) => {
                    const id = person.target.memberId;
                    const own = id === userId;
                    const unread = unreadChats.get(person.key) ?? 0;
                    const name = person.name || t('Group member');
                    const location =
                      !own &&
                      state.locations.find((loc) => loc.groupId === group.id && loc.id === id);
                    return (
                      <View key={person.key} style={styles.member}>
                        <Avatar uri={person.avatarUrl} name={name} size={34} />
                        <View style={styles.identity}>
                          <Text style={styles.name}>
                            {name}
                            {own ? ' · ' + t('You') : ''}
                          </Text>
                          {location && (
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => onLocate(location)}
                            >
                              <Text style={styles.action}>
                                {t(location.trip ? 'View shared trip' : 'Show on map')} ↗
                              </Text>
                            </Pressable>
                          )}
                        </View>
                        {!own && (
                          <Pressable
                            style={styles.button}
                            accessibilityRole="button"
                            accessibilityLabel={chatButtonLabel(
                              t,
                              t('Private chat with {name}', { name }),
                              unread,
                            )}
                            onPress={() => onChat(group.id, id)}
                          >
                            <ChatIcon unread={unread} />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                  <PrimaryButton
                    busy={false}
                    label={t(
                      state.tripGroupId === group.id ? 'Stop trip sharing' : 'Share my trip',
                    )}
                    disabled={state.busy || (!!state.tripGroupId && state.tripGroupId !== group.id)}
                    onPress={() =>
                      state.tripGroupId === group.id
                        ? commands.stopTrip()
                        : commands.startTrip(membership)
                    }
                  />
                  {membership.ownerId === userId && (
                    <>
                      <Text style={styles.hint}>{t('Invite a contact')}</Text>
                      {contacts
                        .filter(
                          (contact) =>
                            contact.peerId && !membership.memberIds.includes(contact.peerId),
                        )
                        .map((contact) => (
                          <Pressable
                            key={contact.id}
                            accessibilityRole="button"
                            disabled={state.busy || membership.memberIds.length >= 10}
                            onPress={() =>
                              contact.peerId && commands.invite(membership, contact.peerId)
                            }
                            style={styles.member}
                          >
                            <Text style={[styles.name, styles.identity]}>{contact.name}</Text>
                            <Text style={styles.action}>
                              {state.action === 'invite:' + contact.peerId ? (
                                <ActivityIndicator color={colors.accent} />
                              ) : (
                                t('Invite')
                              )}
                            </Text>
                          </Pressable>
                        ))}
                      {membership.memberIds.length >= 10 && (
                        <Text style={styles.hint}>{t('Groups support up to 10 members.')}</Text>
                      )}
                    </>
                  )}
                  {confirming !== group.id ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={state.busy}
                      onPress={() => setConfirming(group.id)}
                      style={styles.button}
                    >
                      <Text style={styles.destructive}>
                        {t(membership.ownerId === userId ? 'Delete group' : 'Leave group')}
                      </Text>
                    </Pressable>
                  ) : (
                    <View>
                      <Text accessibilityRole="alert" style={styles.name}>
                        {t(membership.ownerId === userId ? 'Delete “{name}”?' : 'Leave “{name}”?', {
                          name: group.name,
                        })}
                      </Text>
                      <View style={styles.confirmActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={state.busy}
                          onPress={() => setConfirming('')}
                          style={styles.button}
                        >
                          <Text style={styles.action}>{t('No')}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          disabled={state.busy}
                          style={styles.button}
                          onPress={() => {
                            setConfirming('');
                            void commands.leave(membership);
                          }}
                        >
                          <Text style={styles.destructive}>{t('Yes')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <>
            {!!state.error && (
              <Pressable accessibilityRole="button" onPress={commands.start} style={styles.button}>
                <Text style={styles.action}>{t('Retry')}</Text>
              </Pressable>
            )}
          </>
        }
      />
      <View style={styles.createAction}>
        <PrimaryButton
          label={t('Create private group')}
          busy={false}
          disabled={state.busy}
          onPress={() => {
            commands.setName('');
            setConfirming('');
            setCreating(true);
          }}
        />
      </View>
    </>
  );
}
const styles = StyleSheet.create({
  list: { paddingBottom: 12 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sectionCount: {
    color: colors.accent,
    backgroundColor: '#BCB5FF18',
    borderRadius: 9,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  empty: { paddingVertical: 20, textAlign: 'center' },
  groupCard: { paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6, borderRadius: 18 },
  content: { gap: 16, paddingBottom: 20 },
  createAction: { paddingTop: 4, paddingBottom: 12 },
  card: {
    padding: 18,
    gap: 14,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
  },
  selected: { borderColor: colors.accent },
  identity: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  action: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  button: { minHeight: 44, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  groupChatButton: { flexDirection: 'row', gap: 8, paddingHorizontal: 8 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  destructive: { color: '#ffb4be', fontSize: 13 },
});
