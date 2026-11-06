import React, { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import type { ChatViewModel } from '../viewmodels/ChatViewModel';
import type { ChatMessage, ReadTime } from '../models/chat';
import { MessageComposer } from './MessageComposer';
const readVisibility = { viewAreaCoveragePercentThreshold: 50, minimumViewTime: 250 };
export function MessagePane({
  uid,
  state,
  commands,
  groupRoom,
  onRead,
}: {
  uid: string;
  groupRoom: boolean;
  onRead?: (through: ReadTime) => void;
  state: ReturnType<ChatViewModel['getSnapshot']>;
  commands: Pick<ChatViewModel, 'start' | 'older' | 'send' | 'setDraft'>;
}) {
  const { t } = useTranslation();
  return (
    <>
      {!!state.error && (
        <View style={s.errorRow}>
          <Text accessibilityRole="alert" style={s.error}>
            {t(state.error)}
          </Text>
          {state.error !== 'Message could not be sent. Try again.' && (
            <Pressable style={s.link} accessibilityRole="button" onPress={commands.start}>
              <Text style={s.accent}>{t('Retry')}</Text>
            </Pressable>
          )}
        </View>
      )}
      {!state.messages.length ? (
        <View style={s.empty}>
          {state.loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : groupRoom ? (
            <>
              <Text style={s.emptyHeading}>{t('Group chat')}</Text>
              <Text style={s.muted}>{t('Everyone in this group can read messages here.')}</Text>
            </>
          ) : null}
        </View>
      ) : (
        <MessageTimeline
          uid={uid}
          messages={state.messages}
          loading={state.loading}
          more={state.more}
          onOlder={commands.older}
          onRead={onRead}
        />
      )}
      <MessageComposer
        draft={state.draft}
        sending={state.sending}
        groupRoom={groupRoom}
        onChangeText={commands.setDraft}
        onSend={commands.send}
      />
    </>
  );
}
const MessageTimeline = memo(function MessageTimeline({
  uid,
  messages,
  loading,
  more,
  onOlder,
  onRead,
}: {
  uid: string;
  messages: ReturnType<ChatViewModel['getSnapshot']>['messages'];
  loading: boolean;
  more: boolean;
  onOlder: () => void;
  onRead?: (through: ReadTime) => void;
}) {
  // Visibility drives read receipts only. Scrolling shouldn't redraw the message bubbles.
  const visible = useRef(new Set<string>());
  const reportVisible = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    reportVisible.current = () => {
      if (!onRead) return;
      const newest = messages.find(
        (message) => message.createdAt && visible.current.has(message.id),
      );
      if (newest?.createdAt) onRead(newest.createdAt);
    };
    // A visible pending message can acquire its server timestamp without scrolling.
    reportVisible.current();
    return () => {
      reportVisible.current = () => {};
    };
  }, [messages, onRead]);
  const viewable = useCallback(
    ({ viewableItems }: { viewableItems: readonly { item: ChatMessage }[] }) => {
      visible.current = new Set(viewableItems.map(({ item }) => item.id));
      reportVisible.current();
    },
    [],
  );
  const { t, language } = useTranslation();
  const clock = useMemo(
    () => new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit' }),
    [language],
  );
  const date = useMemo(
    () => new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', year: 'numeric' }),
    [language],
  );
  return (
    <FlatList
      inverted
      viewabilityConfig={readVisibility}
      onViewableItemsChanged={viewable}
      style={s.list}
      contentContainerStyle={s.timeline}
      data={messages}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      ListFooterComponent={
        more ? (
          <Pressable accessibilityRole="button" disabled={loading} onPress={onOlder} style={s.link}>
            <Text style={s.accent}>{t('Earlier messages')}</Text>
          </Pressable>
        ) : undefined
      }
      renderItem={({ item, index }) => {
        const mine = item.fromId === uid;
        const previous = messages[index + 1];
        return (
          <View>
            {(!previous ||
              new Date(previous.time).toDateString() !== new Date(item.time).toDateString()) && (
              <Text style={s.date}>{date.format(item.time)}</Text>
            )}
            <View style={[s.bubble, mine ? s.out : s.incoming]}>
              {item.senderName && !mine && <Text style={s.accent}>{item.senderName}</Text>}
              <Text selectable style={s.body}>
                {item.text}
              </Text>
              <Text style={s.stamp}>{item.pending ? t('Sending…') : clock.format(item.time)}</Text>
            </View>
          </View>
        );
      }}
    />
  );
});
const s = StyleSheet.create({
  muted: { color: colors.muted, textAlign: 'center' },
  empty: { flex: 1, padding: 20, gap: 6, alignItems: 'center', justifyContent: 'center' },
  emptyHeading: { fontSize: 16, fontWeight: '600', color: colors.text },
  list: { flex: 1 },
  timeline: { padding: 14 },
  bubble: {
    maxWidth: '82%',
    minWidth: 68,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 6,
    marginVertical: 3,
    borderRadius: 17,
  },
  out: { backgroundColor: '#403A63', alignSelf: 'flex-end', borderBottomRightRadius: 5 },
  incoming: { backgroundColor: '#222631', alignSelf: 'flex-start', borderBottomLeftRadius: 5 },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  stamp: { alignSelf: 'flex-end', fontSize: 11, color: '#D0CCDE', marginTop: 3 },
  date: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.input,
    color: colors.muted,
    fontSize: 12,
    marginVertical: 8,
  },
  errorRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#33202A',
    flexDirection: 'row',
    alignItems: 'center',
  },
  error: { color: '#FFB4BE', flex: 1 },
  link: { paddingHorizontal: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  accent: { color: colors.accent, fontWeight: '600' },
});
