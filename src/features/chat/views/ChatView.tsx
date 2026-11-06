import React, { useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { Avatar } from '../../../shared/ui/Avatar';
import { UnreadBadge, chatButtonLabel } from '../../../shared/ui/UnreadBadge';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { TextField } from '../../../shared/ui/TextField';
import {
  selectConversation,
  visibleConversations,
  type Conversation,
  type ChatSelection,
} from '../models/conversations';
import { ContactsIcon } from '../../../shared/ui/ContactsIcon';
import type { PrivateGroup } from '../../contacts/models/sharing';
interface Props {
  rows: Conversation[];
  selected?: Conversation;
  transcript: React.ReactNode;
  expandedGroup?: PrivateGroup;
  onSelect: (choice: ChatSelection) => void;
  onBack: () => void;
  onRetry: () => void;
  onContacts: () => void;
  loading: boolean;
  error: string;
}
export function ChatView({
  rows,
  selected,
  expandedGroup,
  transcript,
  onSelect,
  onBack,
  onRetry,
  onContacts,
  loading,
  error,
}: Props) {
  const { t, language } = useTranslation();
  const formats = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit' }),
      date: new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }),
    }),
    [language],
  );
  const compact = useWindowDimensions().width < 640;
  const [search, setSearch] = useState('');
  const term = useDeferredValue(search.trim().toLocaleLowerCase());
  const filtered = useMemo(
    () => visibleConversations(rows, expandedGroup?.id, term),
    [rows, term, expandedGroup?.id],
  );
  const groupRoom = !!selected && 'groupId' in selected.target && !('memberId' in selected.target);
  return (
    <KeyboardAvoidingView enabled={Platform.OS === 'ios'} behavior="padding" style={s.screen}>
      <ScreenHeader title={t('Chats')} onBack={onBack} />
      <TextField
        style={s.search}
        accessibilityLabel={t('Search chats')}
        placeholder={t('Search chats')}
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        autoCorrect={false}
      />
      {!!error && (
        <Pressable accessibilityRole="button" style={s.error} onPress={onRetry}>
          <Text style={s.hint}>
            {t(error)} · {t('Retry')}
          </Text>
        </Pressable>
      )}
      <View style={s.panes}>
        <FlatList
          style={[s.sidebar, { width: compact ? 96 : 260 }]}
          data={filtered}
          keyExtractor={(row) => row.key}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={s.empty}>{t('No matches')}</Text>
            )
          }
          renderItem={({ item, index }) => {
            const member = 'memberId' in item.target;
            const room = 'groupId' in item.target && !member;
            const name = item.name || t('Group member');
            // Collapsed rooms also indicate unread private threads inside the room.
            const unread =
              (item.unread ?? 0) +
              ('groupId' in item.target && room && item.target.groupId !== expandedGroup?.id
                ? (item.members?.reduce((sum, m) => sum + (m.unread ?? 0), 0) ?? 0)
                : 0);
            const actionLabel = t(room ? 'Open group chat: {name}' : 'Private chat with {name}', {
              name,
            });
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={chatButtonLabel(t, actionLabel, unread)}
                  accessibilityState={{ selected: item.key === selected?.key }}
                  onPress={() => onSelect(selectConversation(item))}
                  style={({ pressed }) => [
                    s.row,
                    compact ? s.compact : s.wide,
                    member && s.member,
                    item.key === selected?.key && s.active,
                    pressed && s.pressed,
                  ]}
                >
                  <View>
                    {room ? (
                      <View style={s.groupIcon}>
                        <ContactsIcon />
                      </View>
                    ) : (
                      <Avatar
                        uri={item.avatarUrl}
                        name={name}
                        size={member ? 29 : compact ? 36 : 42}
                      />
                    )}
                    <UnreadBadge count={unread} />
                  </View>
                  <View style={compact ? s.compactLabel : s.identity}>
                    <Text numberOfLines={compact ? 2 : 1} style={[s.name, compact && s.small]}>
                      {name}
                    </Text>
                    {!!timestamp && compact && (
                      <Text numberOfLines={1} style={[s.time, s.centered]}>
                        {timestamp}
                      </Text>
                    )}
                    {!compact && (
                      <Text numberOfLines={1} style={s.hint}>
                        {item.preview?.text ??
                          t(room ? 'Group chat' : member ? 'Group member' : 'Contact')}
                      </Text>
                    )}
                  </View>
                  {!!timestamp && !compact && (
                    <Text numberOfLines={1} style={s.time}>
                      {timestamp}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          }}
        />
        <View style={s.thread}>
          {selected ? (
            <>
              <View style={s.threadHeader}>
                <Text accessibilityRole="header" numberOfLines={1} style={s.name}>
                  {selected.name || t('Group member')}
                </Text>
                {groupRoom ? (
                  <Text style={s.hint}>
                    {t('Group chat') +
                      ' · ' +
                      t(expandedGroup?.joinedIds.length === 1 ? '1 member' : '{count} members', {
                        count: expandedGroup?.joinedIds.length ?? 0,
                      })}
                  </Text>
                ) : (
                  'memberId' in selected.target &&
                  expandedGroup && <Text style={s.hint}>{expandedGroup.name}</Text>
                )}
              </View>
              {transcript}
            </>
          ) : (
            <View style={s.placeholder}>
              <Text style={s.hint}>{t('Choose a conversation')}</Text>
              <Pressable accessibilityRole="button" style={s.link} onPress={onContacts}>
                <Text style={s.accent}>{t('Contacts')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  search: { marginHorizontal: 16, minHeight: 44, marginTop: 4, marginBottom: 10 },
  panes: {
    flex: 1,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sidebar: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.input,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: {
    alignItems: 'center',
    gap: 5,
    padding: 7,
    marginHorizontal: 4,
    marginVertical: 2,
    borderRadius: 12,
  },
  active: { backgroundColor: '#343149' },
  rosterLabel: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 11,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  pressed: { opacity: 0.72 },
  member: {
    marginLeft: 12,
    marginVertical: 0,
    borderLeftWidth: 2,
    borderLeftColor: '#4D4963',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingVertical: 6,
  },
  groupIcon: {
    backgroundColor: '#BCB5FF18',
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compact: { paddingVertical: 10 },
  wide: { flexDirection: 'row', minHeight: 64 },
  identity: { flex: 1 },
  compactLabel: { alignSelf: 'stretch' },
  name: { color: colors.text, fontWeight: '600', fontSize: 16 },
  small: { fontSize: 12, textAlign: 'center' },
  time: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  centered: { textAlign: 'center' },
  hint: { fontSize: 13, color: colors.muted },
  empty: { padding: 8, color: colors.muted, textAlign: 'center' },
  thread: { flex: 1, minWidth: 0 },
  threadHeader: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10 },
  link: { minHeight: 44, justifyContent: 'center' },
  accent: { color: colors.accent },
  error: { padding: 10 },
});
