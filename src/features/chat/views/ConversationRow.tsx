import React, { memo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { Avatar } from '../../../shared/ui/Avatar';
import { ContactsIcon } from '../../../shared/ui/ContactsIcon';
import { UnreadBadge, chatButtonLabel } from '../../../shared/ui/UnreadBadge';
import { interviewInvitation } from '../../interviews/models/interview';
import { CallIcon } from '../../interviews/views/CallIcon';
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
  onToggleMembers?: (choice: ChatSelection) => void;
}) {
  const { t } = useTranslation();
  const member = 'memberId' in item.target;
  const room = 'groupId' in item.target && !member;
  const name = item.name || t('Group member');
  const preview = item.preview?.text;
  const callMode =
    preview === interviewInvitation.voice
      ? 'voice'
      : preview === interviewInvitation.video
        ? 'video'
        : undefined;
  const selection = useChatProgress(active ? 1 : 0);
  const disclosure = useChatProgress(expanded ? 1 : 0);
  const press = useChatPress();
  return (
    <Animated.View
      style={[
        s.container,
        s.surface,
        room && !compact && s.groupSurface,
        member && !compact && s.member,
        !!unread && !compact && s.unreadSurface,
        press.style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.selected, { opacity: selection }]}
      />
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
        style={[s.row, compact ? s.compact : s.wide]}
      >
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
            <Avatar uri={item.avatarUrl} name={name} size={compact || member ? 42 : 46} />
          )}
          {compact && <UnreadBadge count={unread} />}
        </View>
        <View style={compact ? s.compactLabel : s.identity}>
          <View style={!compact && s.headline}>
            <Text
              numberOfLines={compact ? 2 : 1}
              style={[
                s.name,
                !compact && s.growing,
                compact && s.small,
                active && s.selectedName,
                !!unread && s.unreadName,
              ]}
            >
              {name}
            </Text>
            {!compact && !!timestamp && (
              <Text numberOfLines={1} style={[s.time, !!unread && s.unreadTime]}>
                {timestamp}
              </Text>
            )}
          </View>
          {!compact && (
            <View style={s.headline}>
              <View style={s.previewLine}>
                {callMode && (
                  <View style={s.previewIcon}>
                    <CallIcon kind={callMode} />
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  style={[
                    s.preview,
                    s.growing,
                    callMode && s.callPreview,
                    !!unread && s.unreadPreview,
                  ]}
                >
                  {callMode
                    ? t(callMode === 'voice' ? 'Voice call' : 'Video call')
                    : preview === ''
                      ? t('Message deleted')
                      : (preview ?? t(room ? 'Group chat' : member ? 'Group member' : 'Contact'))}
                </Text>
              </View>
              <UnreadBadge count={unread} inline />
            </View>
          )}
        </View>
      </Pressable>
      {room && onToggleMembers && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(expanded ? 'Hide group members' : 'Show group members')}
          accessibilityState={{ expanded }}
          onPress={(event) => {
            event.stopPropagation();
            onToggleMembers({
              key: item.key,
              groupId: 'groupId' in item.target ? item.target.groupId : undefined,
            });
          }}
          style={({ pressed }) => [
            s.toggle,
            expanded && s.toggleExpanded,
            pressed && s.togglePressed,
          ]}
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
    </Animated.View>
  );
});

const s = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#272A35',
  },
  surface: { backgroundColor: colors.input },
  groupSurface: { backgroundColor: '#1D1E2A' },
  unreadSurface: { borderColor: '#8277BD' },
  row: { alignItems: 'center', gap: 7, padding: 8, borderRadius: 16 },
  compact: { paddingVertical: 11, minHeight: 84 },
  wide: { flex: 1, minWidth: 0, flexDirection: 'row', minHeight: 78, gap: 12, padding: 12 },
  member: { marginLeft: 36, backgroundColor: '#15171F', borderColor: '#232630' },
  selected: {
    backgroundColor: '#BCB5FF18',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BCB5FF28',
  },
  groupIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#BCB5FF23',
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
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.accent,
  },
  identity: { flex: 1, minWidth: 0, gap: 5 },
  headline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  growing: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '600' },
  small: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  selectedName: { color: '#E7E3FF' },
  unreadName: { fontWeight: '700' },
  unreadTime: { color: colors.accent },
  preview: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  previewLine: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  previewIcon: {
    width: 16,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 0.65 }],
  },
  callPreview: { color: '#C9C2FF' },
  unreadPreview: { color: colors.text, fontWeight: '600' },
  time: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  toggle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginRight: 6,
    backgroundColor: '#FFFFFF04',
  },
  toggleExpanded: { backgroundColor: '#BCB5FF24' },
  togglePressed: { backgroundColor: '#BCB5FF38' },
});
