import React, { memo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { Avatar } from '../../../shared/ui/Avatar';
import { ContactsIcon } from '../../../shared/ui/ContactsIcon';
import { UnreadBadge, chatButtonLabel } from '../../../shared/ui/UnreadBadge';
import { selectConversation, type Conversation, type ChatSelection } from '../models/conversations';
import { useChatPress, useChatProgress } from './chatMotion';

export const ConversationRow = memo(function ConversationRow({
  item,
  compact,
  active,
  expanded,
  unread,
  timestamp,
  onSelect,
  onToggleMembers,
}: {
  item: Conversation;
  compact: boolean;
  active: boolean;
  expanded?: boolean;
  unread: number;
  timestamp?: string;
  onSelect: (choice: ChatSelection) => void;
  onToggleMembers?: () => void;
}) {
  const { t } = useTranslation();
  const member = 'memberId' in item.target;
  const room = 'groupId' in item.target && !member;
  const name = item.name || t('Group member');
  const selection = useChatProgress(active ? 1 : 0);
  const disclosure = useChatProgress(expanded ? 1 : 0);
  const press = useChatPress();
  return (
    <Animated.View style={[s.container, press.style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={chatButtonLabel(
          t,
          t(room ? 'Open group chat: {name}' : 'Private chat with {name}', { name }),
          unread,
        )}
        accessibilityState={{ selected: active, expanded }}
        onPress={() => onSelect(selectConversation(item))}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[s.row, compact ? s.compact : s.wide, member && !compact && s.member]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, s.selected, { opacity: selection }]}
        />
        <Animated.View pointerEvents="none" style={[s.indicator, { opacity: selection }]} />
        <View>
          {room ? (
            <View style={s.groupIcon}>
              <ContactsIcon />
              {compact && (
                <View style={s.disclosure} accessible={false}>
                  <Animated.View
                    style={[
                      s.chevron,
                      {
                        transform: [
                          {
                            rotate: disclosure.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['-45deg', '45deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          ) : (
            <Avatar uri={item.avatarUrl} name={name} size={compact ? 42 : 48} />
          )}
          {compact && <UnreadBadge count={unread} />}
        </View>
        <View style={compact ? s.compactLabel : s.identity}>
          <Text
            numberOfLines={compact ? 2 : 1}
            style={[s.name, compact && s.small, active && s.selectedName, !!unread && s.unreadName]}
          >
            {name}
          </Text>
          {!compact && (
            <Text numberOfLines={1} style={s.preview}>
              {item.preview?.text === ''
                ? t('Message deleted')
                : (item.preview?.text ??
                  t(room ? 'Group chat' : member ? 'Group member' : 'Contact'))}
            </Text>
          )}
        </View>
        {!compact && (
          <View style={s.metadata}>
            {!!timestamp && <Text style={[s.time, !!unread && s.unreadTime]}>{timestamp}</Text>}
            <UnreadBadge count={unread} inline />
          </View>
        )}
        {room && onToggleMembers && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(expanded ? 'Hide group members' : 'Show group members')}
            accessibilityState={{ expanded }}
            onPress={(event) => {
              event.stopPropagation();
              onToggleMembers();
            }}
            style={s.toggle}
          >
            <Animated.View
              style={[
                s.chevron,
                {
                  transform: [
                    {
                      rotate: disclosure.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-45deg', '45deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  container: { marginHorizontal: 10, marginVertical: 2 },
  row: { alignItems: 'center', gap: 7, padding: 8, borderRadius: 16 },
  compact: { paddingVertical: 11, minHeight: 84 },
  wide: { flexDirection: 'row', minHeight: 78, gap: 12, padding: 12 },
  member: { marginLeft: 12 },
  selected: {
    backgroundColor: '#BCB5FF18',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BCB5FF28',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: colors.accent,
    top: '34%',
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#BCB5FF16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLabel: { alignSelf: 'stretch' },
  disclosure: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 5,
    height: 5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.accent,
  },
  identity: { flex: 1, gap: 4 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  small: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  selectedName: { color: '#E7E3FF' },
  unreadName: { fontWeight: '700' },
  unreadTime: { color: colors.accent },
  metadata: { alignItems: 'flex-end', alignSelf: 'stretch', justifyContent: 'center', gap: 6 },
  preview: { color: colors.muted, fontSize: 13 },
  time: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  toggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
});
