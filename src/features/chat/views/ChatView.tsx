import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { Avatar } from '../../../shared/ui/Avatar';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { SearchField } from '../../../shared/ui/SearchField';
import {
  visibleConversations,
  type Conversation,
  type ChatSelection,
} from '../models/conversations';
import { useLayoutMotion } from '../../../shared/motion/useLayoutMotion';
import { ContactsIcon } from '../../../shared/ui/ContactsIcon';
import { ChatIcon } from '../../../shared/ui/ChatIcon';
import type { PrivateGroup } from '../../contacts/models/sharing';
import { ConversationRow } from './ConversationRow';
import { useConversationMotion } from './chatMotion';
interface Props {
  rows: Conversation[];
  compact: boolean;
  showingList: boolean;
  openingPerson?: boolean;
  onShowList: () => void;
  selected?: Conversation;
  transcript: React.ReactNode;
  expandedGroup?: PrivateGroup;
  onSelect: (choice: ChatSelection, openThread?: boolean) => void;
  onBack: () => void;
  onRetry: () => void;
  onContacts: () => void;
  loading: boolean;
  error: string;
  onThreadOptions: () => void;
}
export function ChatView({
  rows,
  compact,
  showingList,
  openingPerson = false,
  onShowList,
  selected,
  expandedGroup,
  transcript,
  onSelect,
  onBack,
  onRetry,
  onContacts,
  loading,
  error,
  onThreadOptions,
}: Props) {
  const { t, language } = useTranslation();
  const formats = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit' }),
      date: new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }),
    }),
    [language],
  );
  const [search, setSearch] = useState('');
  // Folding a roster is local UI state, independent of the open conversation.
  const [collapsedGroupId, setCollapsedGroupId] = useState<string>();
  const expandedGroupId = expandedGroup?.id === collapsedGroupId ? undefined : expandedGroup?.id;
  const term = useDeferredValue(search.trim().toLocaleLowerCase());
  const filtered = useMemo(
    () => visibleConversations(rows, expandedGroupId, term, collapsedGroupId),
    [rows, term, expandedGroupId, collapsedGroupId],
  );
  const openRosters = useMemo(
    () =>
      new Set([
        expandedGroupId,
        ...filtered.flatMap((row) => ('memberId' in row.target ? [row.target.groupId] : [])),
      ]),
    [expandedGroupId, filtered],
  );
  const groupRoom = !!selected && 'groupId' in selected.target && !('memberId' in selected.target);
  const threadMotion = useConversationMotion(showingList ? undefined : selected?.key, 12);
  const listMotion = useConversationMotion(showingList ? 'list' : undefined, -8);
  const animateLayout = useLayoutMotion();
  const select = useCallback(
    (choice: ChatSelection, openThread = true) => {
      Keyboard.dismiss();
      if (!openThread) animateLayout();
      const room = choice.groupId && choice.key === 'group:' + choice.groupId;
      setCollapsedGroupId(room && openRosters.has(choice.groupId) ? choice.groupId : undefined);
      onSelect(choice, openThread);
    },
    [onSelect, openRosters, animateLayout],
  );
  const conversationHeader = selected ? (
    <View style={[s.threadHeader, compact && s.phoneHeader]}>
      {groupRoom ? (
        <View style={s.headerGroup}>
          <ContactsIcon />
        </View>
      ) : (
        <Avatar uri={selected.avatarUrl} name={selected.name || t('Group member')} size={34} />
      )}
      <View style={s.headerIdentity}>
        <Text accessibilityRole="header" numberOfLines={1} style={s.name}>
          {selected.name || t('Group member')}
        </Text>
        {groupRoom ? (
          <Text numberOfLines={1} style={s.hint}>
            {t('Group chat') +
              ' · ' +
              t(expandedGroup?.joinedIds.length === 1 ? '1 member' : '{count} members', {
                count: expandedGroup?.joinedIds.length ?? 0,
              })}
          </Text>
        ) : (
          'memberId' in selected.target &&
          expandedGroup && (
            <Text numberOfLines={1} style={s.hint}>
              {expandedGroup.name}
            </Text>
          )
        )}
      </View>
      {(compact || groupRoom) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(groupRoom ? 'Show group members' : 'All chats')}
          onPress={() => {
            setCollapsedGroupId(undefined);
            onShowList();
          }}
          style={s.peopleButton}
        >
          <ContactsIcon />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Chat options')}
        onPress={onThreadOptions}
        style={s.peopleButton}
      >
        <Text style={{ color: colors.accent, fontSize: 25, lineHeight: 28 }}>⋮</Text>
      </Pressable>
    </View>
  ) : null;
  return (
    <KeyboardAvoidingView enabled={Platform.OS !== 'web'} behavior="padding" style={s.screen}>
      <ScreenHeader
        title={compact && !showingList && selected ? undefined : t('Chats')}
        onBack={onBack}
      >
        {compact && !showingList ? conversationHeader : null}
      </ScreenHeader>
      {(!compact || showingList) && (
        <View style={s.searchRow}>
          <SearchField
            accessibilityLabel={t('Search chats')}
            placeholder={t('Search chats')}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}
      {!!error && (
        <Pressable accessibilityRole="button" style={s.error} onPress={onRetry}>
          <Text style={s.hint}>
            {t(error)} · {t('Retry')}
          </Text>
        </Pressable>
      )}
      <View style={s.panes}>
        <Animated.FlatList<Conversation>
          style={[
            s.sidebar,
            compact && listMotion,
            compact ? s.phoneList : { width: 276 },
            compact && !showingList && s.hidden,
          ]}
          contentContainerStyle={[s.sidebarContent, !filtered.length && s.emptyList]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          data={filtered}
          keyExtractor={(row) => row.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <View style={s.emptyState}>
                <View style={s.emptyIcon}>
                  <ChatIcon unread={0} />
                </View>
                <Text style={s.empty}>{t(search ? 'No matches' : 'Choose a conversation')}</Text>
                {!search && (
                  <Pressable accessibilityRole="button" onPress={onContacts} style={s.link}>
                    <Text style={s.accent}>{t('Contacts')}</Text>
                  </Pressable>
                )}
              </View>
            )
          }
          renderItem={({ item, index }) => {
            const member = 'memberId' in item.target;
            const room = 'groupId' in item.target && !member;
            const expanded =
              room && 'groupId' in item.target && openRosters.has(item.target.groupId);
            // Collapsed rooms also indicate unread private threads inside the room.
            const unread =
              (item.unread ?? 0) +
              (room && !expanded
                ? (item.members?.reduce((sum, m) => sum + (m.unread ?? 0), 0) ?? 0)
                : 0);
            const last = item.activityTime ? new Date(item.activityTime) : undefined;
            const timestamp =
              last &&
              (last.toDateString() === new Date().toDateString()
                ? formats.time
                : formats.date
              ).format(last);
            return (
              <View>
                {member && (index === 0 || !('memberId' in filtered[index - 1].target)) && (
                  <Text accessibilityRole="header" style={s.rosterLabel}>
                    {t('Members')}
                  </Text>
                )}
                <ConversationRow
                  item={item}
                  compact={false}
                  active={item.key === selected?.key}
                  expanded={room ? expanded : undefined}
                  unread={unread}
                  timestamp={timestamp}
                  onSelect={select}
                  onToggleMembers={
                    room
                      ? () =>
                          select(
                            {
                              key: item.key,
                              groupId: 'groupId' in item.target ? item.target.groupId : undefined,
                            },
                            false,
                          )
                      : undefined
                  }
                />
              </View>
            );
          }}
        />
        <Animated.View style={[s.thread, threadMotion, showingList && s.hidden]}>
          {openingPerson ? (
            <View style={s.placeholder}>
              {!error && <ActivityIndicator color={colors.accent} />}
            </View>
          ) : selected ? (
            <>
              {!compact && conversationHeader}
              {transcript}
            </>
          ) : (
            <View style={s.placeholder}>
              <View style={s.emptyIcon}>
                <ChatIcon unread={0} />
              </View>
              <Text style={s.hint}>{t('Choose a conversation')}</Text>
              <Pressable accessibilityRole="button" style={s.link} onPress={onContacts}>
                <Text style={s.accent}>{t('Contacts')}</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  searchRow: { marginHorizontal: 16, marginTop: 4, marginBottom: 12, justifyContent: 'center' },
  panes: {
    flex: 1,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sidebar: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: '#15171F',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sidebarContent: { paddingTop: 6, paddingBottom: 16 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', padding: 24, gap: 8 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#BCB5FF10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  phoneList: { flex: 1, flexGrow: 1, borderRightWidth: 0, backgroundColor: colors.background },
  hidden: { display: 'none' },
  peopleButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#BCB5FF14',
  },
  rosterLabel: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 11,
    textAlign: 'left',
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 4,
  },
  name: { color: colors.text, fontWeight: '600', fontSize: 16 },
  hint: { fontSize: 12, lineHeight: 17, color: colors.muted },
  empty: { padding: 8, color: colors.muted, textAlign: 'center' },
  thread: { flex: 1, minWidth: 0 },
  phoneHeader: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 4,
    minHeight: 56,
    borderBottomWidth: 0,
    gap: 9,
  },
  threadHeader: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  headerIdentity: { flex: 1, gap: 2 },
  headerGroup: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#BCB5FF18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10 },
  link: { minHeight: 44, justifyContent: 'center' },
  accent: { color: colors.accent },
  error: { padding: 10 },
});
