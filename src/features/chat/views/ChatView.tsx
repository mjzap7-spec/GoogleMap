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
  filterConversations,
  type ConversationFilter,
  type Conversation,
  type ChatSelection,
} from '../models/conversations';
import { useLayoutMotion } from '../../../shared/motion/useLayoutMotion';
import { ContactsIcon } from '../../../shared/ui/ContactsIcon';
import { ChatIcon, EditIcon } from '../../../shared/ui/ChatIcon';
import { InlineRetry } from '../../../shared/ui/InlineRetry';
import type { PrivateGroup } from '../../contacts/models/sharing';
import { ConversationRow } from './ConversationRow';
import { useConversationMotion } from './chatMotion';
import { CallIcon } from '../../interviews/views/CallIcon';
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
  onInterview?: (mode: 'voice' | 'video') => void;
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
  onInterview,
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
  const [filter, setFilter] = useState<ConversationFilter>('all');
  // Folding a roster is local UI state, independent of the open conversation.
  const [collapsedGroupId, setCollapsedGroupId] = useState<string>();
  const expandedGroupId = expandedGroup?.id === collapsedGroupId ? undefined : expandedGroup?.id;
  const term = useDeferredValue(search.trim().toLocaleLowerCase());
  const filtered = useMemo(
    () =>
      visibleConversations(
        filterConversations(rows, filter),
        expandedGroupId,
        term,
        collapsedGroupId,
      ),
    [rows, filter, term, expandedGroupId, collapsedGroupId],
  );
  // Keep event handlers stable when unread counts or previews change, not expansion.
  const rosterKey = JSON.stringify([
    ...(expandedGroupId ? [expandedGroupId] : []),
    ...new Set(filtered.flatMap((row) => ('memberId' in row.target ? [row.target.groupId] : []))),
  ]);
  const openRosters = useMemo(() => new Set<string>(JSON.parse(rosterKey)), [rosterKey]);
  const groupRoom = !!selected && 'groupId' in selected.target && !('memberId' in selected.target);
  const threadMotion = useConversationMotion(showingList ? undefined : selected?.key, 12);
  const listMotion = useConversationMotion(showingList ? 'list' : undefined, -8);
  const animateLayout = useLayoutMotion();
  const select = useCallback(
    (choice: ChatSelection, openThread = true) => {
      Keyboard.dismiss();
      if (!openThread) animateLayout();
      const room = choice.groupId && choice.key === 'group:' + choice.groupId;
      setCollapsedGroupId(
        room && choice.groupId && openRosters.has(choice.groupId) ? choice.groupId : undefined,
      );
      onSelect(choice, openThread);
    },
    [onSelect, openRosters, animateLayout],
  );
  const toggleMembers = useCallback((choice: ChatSelection) => select(choice, false), [select]);
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
      {onInterview &&
        (['voice', 'video'] as const).map((mode) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={t(
              mode === 'voice' ? 'Start voice interview' : 'Start video interview',
            )}
            onPress={() => onInterview(mode)}
            style={({ pressed }) => [s.peopleButton, pressed && { opacity: 0.65 }]}
          >
            <CallIcon kind={mode} />
          </Pressable>
        ))}
      {groupRoom && (
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
        <View style={s.listTools}>
          <View style={s.searchRow}>
            <View style={s.searchInput}>
              <SearchField
                accessibilityLabel={t('Search chats')}
                placeholder={t('Search chats')}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('New message')}
              onPress={onContacts}
              style={({ pressed }) => [s.compose, pressed && { opacity: 0.65 }]}
            >
              <EditIcon />
            </Pressable>
          </View>
          <View style={s.filters}>
            {(
              [
                ['all', 'All chats'],
                ['unread', 'Unread'],
                ['groups', 'Private groups'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: filter === value }}
                onPress={() => setFilter(value)}
                style={({ pressed }) => [
                  s.filter,
                  filter === value && s.filterSelected,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[s.filterLabel, filter === value && s.filterActive]}>{t(label)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {!!error && (
        <View style={s.error}>
          <InlineRetry message={error} onRetry={onRetry} />
        </View>
      )}
      <View style={s.panes}>
        <Animated.FlatList<Conversation>
          style={[
            s.sidebar,
            compact && listMotion,
            compact ? s.phoneList : s.tabletList,
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
                <Text style={s.empty}>
                  {t(
                    search
                      ? 'No matches'
                      : filter === 'unread'
                        ? 'You’re all caught up'
                        : 'Choose a conversation',
                  )}
                </Text>
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
                  onToggleMembers={room ? toggleMembers : undefined}
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
  listTools: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minWidth: 0 },
  compose: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#BCB5FF20',
    borderWidth: 1,
    borderColor: '#BCB5FF30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 12, paddingBottom: 14 },
  filter: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 13,
  },
  filterSelected: { backgroundColor: '#BCB5FF1B' },
  filterLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  filterActive: { color: colors.accent },
  panes: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: '#15171F',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sidebarContent: {
    paddingTop: 2,
    paddingBottom: 20,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
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
  tabletList: { width: '40%', minWidth: 320, maxWidth: 400 },
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
  headerIdentity: { flex: 1, minWidth: 0, gap: 2 },
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
  error: { paddingHorizontal: 20, width: '100%', maxWidth: 760, alignSelf: 'center' },
});
