import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Platform,
  BackHandler,
} from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import type { ChatViewModel, ClearChatTarget } from '../viewmodels/ChatViewModel';
import type { ChatMessage, MessageReply, ReadTime } from '../models/chat';
import { MessageComposer } from './MessageComposer';
import { continuesMessageRun } from '../models/messageLayout';
import { useMessageArrival, useChatProgress } from './chatMotion';
import { messageStatus, type MessageStatus } from '../models/messageStatus';
import { MessageChecks } from './MessageChecks';
import { ReplyPreview } from './ReplyPreview';
import { Feedback } from '../../../shared/ui/Feedback';
import { ChatHistorySheet } from './ChatHistorySheet';
import { MessageSelectionBar } from './MessageSelectionBar';
import { useLayoutMotion } from '../../../shared/motion/useLayoutMotion';
import { SelectionCheck } from './SelectionCheck';
import {
  callMessagePrefix,
  interviewInvitation,
  type CallHistory,
} from '../../interviews/models/interview';
import { CallIcon } from '../../interviews/views/CallIcon';
import { AnimatedEmoji } from './AnimatedEmoji';
import { messageEmoji } from '../models/messageEmoji';
type WatchCall = (
  id: string,
  next: (history: CallHistory | undefined) => void,
) => (() => void) | undefined;
// Commit reads as soon as a message is on screen, including partially visible long rows.
const readVisibility = { viewAreaCoveragePercentThreshold: 1 };
const scrollAnchor = { minIndexForVisible: 0, autoscrollToTopThreshold: 36 };
export function MessagePane({
  watchCall,
  uid,
  state,
  commands,
  groupRoom,
  onRead,
  peerName,
  optionsRequest = 0,
}: {
  watchCall?: WatchCall;
  uid: string;
  groupRoom: boolean;
  onRead?: (through: ReadTime) => void;
  peerName: string;
  optionsRequest?: number;
  state: ReturnType<ChatViewModel['getSnapshot']>;
  commands: Pick<
    ChatViewModel,
    | 'start'
    | 'older'
    | 'send'
    | 'setDraft'
    | 'reply'
    | 'edit'
    | 'cancelAction'
    | 'beginSelection'
    | 'toggleSelection'
    | 'selectAll'
    | 'cancelSelection'
    | 'deleteLocal'
    | 'clearLocal'
    | 'prepareClear'
  >;
}) {
  const { t } = useTranslation();
  const [composerHeight, setComposerHeight] = useState(68);
  const [historySheet, setHistorySheet] = useState<{
    mode: 'options' | 'clear';
    target?: ClearChatTarget;
  }>();
  const animateLayout = useLayoutMotion();
  const [handledOptions, setHandledOptions] = useState(0);
  if (optionsRequest !== handledOptions) {
    setHandledOptions(optionsRequest);
    if (optionsRequest) setHistorySheet({ mode: 'options' });
  }
  useEffect(() => {
    if (!state.selecting) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      animateLayout();
      commands.cancelSelection();
      return true;
    });
    return () => back.remove();
  }, [state.selecting, commands, animateLayout]);
  const beginSelection = useCallback(
    (id?: string) => {
      Keyboard.dismiss();
      animateLayout();
      commands.beginSelection(id);
    },
    [animateLayout, commands],
  );
  const selected =
    state.selectedIds.length === 1
      ? state.messages.find((message) => message.id === state.selectedIds[0])
      : undefined;
  const toggleSelection = useCallback(
    (id: string) => {
      animateLayout();
      commands.toggleSelection(id);
    },
    [animateLayout, commands],
  );
  const busy = state.localBusy || !!state.deletingId;
  const context = state.editing
    ? { label: t('Editing message'), text: state.editing.text }
    : state.replying
      ? {
          label: t('Replying to {name}', {
            name: state.replying.fromId === uid ? t('You') : state.replying.senderName || peerName,
          }),
          text: state.replying.text,
        }
      : undefined;
  const sendError =
    state.actionError === 'Message could not be sent. Try again.' ||
    state.actionError === 'Message could not be edited. Try again.'
      ? state.actionError
      : '';
  const error = state.error || state.receiptError;
  return (
    <View style={[s.pane, { paddingBottom: state.selecting ? 0 : composerHeight }]}>
      <Feedback source="chat-message-action" error={sendError ? '' : state.actionError} />
      {!!sendError && !state.selecting && (
        <View style={s.errorRow}>
          <Text accessibilityRole="alert" style={s.error}>
            {t(sendError)}
          </Text>
          <Pressable
            style={s.link}
            accessibilityRole="button"
            disabled={state.sending || !state.draft.trim()}
            onPress={commands.send}
          >
            <Text style={s.accent}>{t('Retry')}</Text>
          </Pressable>
        </View>
      )}
      {state.selecting && (
        <MessageSelectionBar
          count={state.selectedIds.length}
          busy={busy}
          selectingAll={state.selectingAll}
          allSelected={state.allSelected}
          onCancel={() => {
            animateLayout();
            commands.cancelSelection();
          }}
          onSelectAll={() => {
            if (state.allSelected || state.selectingAll) animateLayout();
            commands.selectAll();
          }}
          onReply={
            selected && !selected.pending
              ? () => {
                  animateLayout();
                  commands.reply(selected.id);
                }
              : undefined
          }
          onEdit={
            selected && !selected.pending && selected.fromId === uid
              ? () => {
                  animateLayout();
                  commands.edit(selected.id);
                }
              : undefined
          }
          onDelete={() => {
            animateLayout();
            void commands.deleteLocal(state.selectedIds);
          }}
        />
      )}
      {!!error && (
        <View style={s.errorRow}>
          <Text accessibilityRole="alert" style={s.error}>
            {t(error)}
          </Text>
          <Pressable style={s.link} accessibilityRole="button" onPress={commands.start}>
            <Text style={s.accent}>{t('Retry')}</Text>
          </Pressable>
        </View>
      )}
      {!state.messages.length ? (
        <View style={s.empty}>
          {state.loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Text style={s.emptyHeading}>{t('No messages here yet')}</Text>
              {state.more && (
                <Pressable accessibilityRole="button" style={s.link} onPress={commands.older}>
                  <Text style={s.accent}>{t('Earlier messages')}</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      ) : (
        <MessageTimeline
          watchCall={watchCall}
          uid={uid}
          messages={state.messages}
          readThrough={state.readThrough}
          loading={state.loading || state.selectingAll}
          more={state.more}
          onOlder={commands.older}
          onRead={onRead}
          onActions={beginSelection}
          actionsDisabled={state.sending || busy}
          selecting={state.selecting}
          selectedIds={state.selectedIds}
          onToggle={toggleSelection}
          peerName={groupRoom ? t('Group member') : peerName}
        />
      )}
      {!state.selecting && (
        <MessageComposer
          height={composerHeight}
          onHeightChange={setComposerHeight}
          draft={state.draft}
          sending={state.sending || state.localBusy}
          groupRoom={groupRoom}
          onChangeText={commands.setDraft}
          onSend={commands.send}
          context={context}
          actionKey={
            state.editing
              ? 'edit:' + state.editing.id
              : state.replying
                ? 'reply:' + state.replying.id
                : undefined
          }
          editing={!!state.editing}
          onCancelAction={commands.cancelAction}
        />
      )}
      {historySheet && (
        <ChatHistorySheet
          mode={historySheet.mode}
          busy={busy}
          error={state.actionError}
          onClose={() => setHistorySheet(undefined)}
          onSelect={() => beginSelection()}
          onClear={() => {
            animateLayout();
            setHistorySheet({ mode: 'clear', target: commands.prepareClear() });
          }}
          onConfirm={() => {
            if (historySheet.mode !== 'clear' || !historySheet.target) return;
            void commands.clearLocal(historySheet.target).then((saved) => {
              if (saved) {
                animateLayout();
                setHistorySheet(undefined);
              }
            });
          }}
        />
      )}
    </View>
  );
}
const MessageTimeline = memo(function MessageTimeline({
  watchCall,
  uid,
  messages,
  readThrough,
  loading,
  more,
  onOlder,
  onRead,
  onActions,
  actionsDisabled,
  peerName,
  selecting,
  selectedIds,
  onToggle,
}: {
  watchCall?: WatchCall;
  uid: string;
  messages: ReturnType<ChatViewModel['getSnapshot']>['messages'];
  readThrough?: ReadTime;
  loading: boolean;
  more: boolean;
  onOlder: () => void;
  onRead?: (through: ReadTime) => void;
  onActions: (id: string) => void;
  actionsDisabled: boolean;
  peerName: string;
  selecting: boolean;
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
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
  const selection = useMemo(() => new Set(selectedIds), [selectedIds]);
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
      keyboardDismissMode="on-drag"
      maintainVisibleContentPosition={scrollAnchor}
      initialNumToRender={20}
      maxToRenderPerBatch={12}
      windowSize={9}
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
        const joinedAbove = continuesMessageRun(previous, item);
        return (
          <View>
            {(!previous ||
              new Date(previous.time).toDateString() !== new Date(item.time).toDateString()) && (
              <Text style={s.date}>{date.format(item.time)}</Text>
            )}
            <MessageBubble
              watchCall={watchCall}
              id={item.id}
              onActions={actionsDisabled ? undefined : onActions}
              reply={item.reply}
              uid={uid}
              peerName={peerName}
              edited={item.edited}
              selecting={selecting}
              selected={selection.has(item.id)}
              onToggle={actionsDisabled ? undefined : onToggle}
              mine={mine}
              newest={index === 0}
              joinedAbove={joinedAbove}
              text={item.text}
              sender={!mine && !joinedAbove ? item.senderName : undefined}
              stamp={item.pending ? t('Sending…') : clock.format(item.time)}
              pending={item.pending}
              status={mine ? messageStatus(item, readThrough) : undefined}
            />
          </View>
        );
      }}
    />
  );
});

const MessageBubble = memo(function MessageBubble({
  watchCall,
  mine,
  newest,
  joinedAbove,
  text,
  sender,
  stamp,
  pending,
  status,
  id,
  onActions,
  reply,
  uid,
  peerName,
  edited,
  selecting,
  selected,
  onToggle,
}: {
  watchCall?: WatchCall;
  mine: boolean;
  newest: boolean;
  joinedAbove: boolean;
  text: string;
  sender?: string;
  stamp: string;
  pending: boolean;
  status?: MessageStatus;
  id: string;
  onActions?: (id: string) => void;
  reply?: MessageReply;
  uid: string;
  peerName: string;
  edited?: boolean;
  selecting: boolean;
  selected: boolean;
  onToggle?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const arrival = useMessageArrival(newest);
  const highlight = useChatProgress(selected ? 1 : 0, 160);
  const interview =
    text === interviewInvitation.voice
      ? 'voice'
      : text === interviewInvitation.video
        ? 'video'
        : undefined;
  const emoji = interview ? undefined : messageEmoji(text);
  const [replay, setReplay] = useState(0);
  return (
    <View style={s.messageRow}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.selectedRow, { opacity: highlight }]}
      />
      {selecting && (
        <MessageSelectionControl
          text={text}
          selected={selected}
          disabled={!onToggle}
          onPress={() => onToggle?.(id)}
        />
      )}
      <View style={s.bubbleColumn}>
        <Animated.View
          style={[
            s.bubble,
            interview && s.invitationBubble,
            mine ? s.out : s.incoming,
            joinedAbove && s.joined,
            joinedAbove && (mine ? s.outAbove : s.inAbove),
            arrival,
          ]}
        >
          <Pressable
            onLongPress={() => (selecting ? onToggle?.(id) : onActions?.(id))}
            delayLongPress={300}
            onPress={
              selecting
                ? () => onToggle?.(id)
                : emoji
                  ? () => setReplay((value) => value + 1)
                  : Platform.OS === 'web'
                    ? () => onActions?.(id)
                    : undefined
            }
            accessibilityRole={selecting ? 'checkbox' : onActions ? 'button' : undefined}
            accessibilityState={selecting ? { checked: selected } : undefined}
            accessibilityHint={onActions ? t('Long press for message actions') : undefined}
            accessibilityActions={
              onActions ? [{ name: 'activate', label: t('Message actions') }] : undefined
            }
            onAccessibilityAction={() => (selecting ? onToggle?.(id) : onActions?.(id))}
          >
            {!!sender && <Text style={s.sender}>{sender}</Text>}
            {reply && <ReplyPreview reply={reply} uid={uid} peerName={peerName} />}
            {interview ? (
              <View style={s.invitation}>
                <View style={s.invitationIcon}>
                  <CallIcon kind={interview} />
                </View>
                <View style={s.invitationDetails}>
                  <Text style={s.invitationTitle}>
                    {t(interview === 'voice' ? 'Voice interview' : 'Video interview')}
                  </Text>
                  {id.startsWith(callMessagePrefix) && (
                    <CallOutcome
                      watchCall={watchCall}
                      callId={id.slice(callMessagePrefix.length)}
                    />
                  )}
                  <View style={s.invitationMeta}>
                    <Text style={s.invitationLabel}>
                      {pending ? stamp : t('Called at {time}', { time: stamp })}
                    </Text>
                    {status && status !== 'sending' && <MessageChecks read={status === 'read'} />}
                  </View>
                </View>
              </View>
            ) : emoji ? (
              <AnimatedEmoji emoji={emoji} autoplay={newest} replay={replay} disabled={selecting} />
            ) : (
              <Text style={s.body}>{text}</Text>
            )}
            {!interview && (
              <View style={s.metadata}>
                {!!edited && <Text style={s.stamp}>{t('edited')}</Text>}
                <Text style={s.stamp}>{stamp}</Text>
                {status && status !== 'sending' && <MessageChecks read={status === 'read'} />}
              </View>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
});
function MessageSelectionControl({
  text,
  selected,
  disabled,
  onPress,
}: {
  text: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const appearance = useMessageArrival(true);
  return (
    <Animated.View style={[s.selectionColumn, appearance]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled }}
        accessibilityLabel={text}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [s.selectionControl, pressed && s.selectionPressed]}
      >
        <SelectionCheck checked={selected} />
      </Pressable>
    </Animated.View>
  );
}
function CallOutcome({ callId, watchCall }: { callId: string; watchCall?: WatchCall }) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<CallHistory>();
  useEffect(() => watchCall?.(callId, setHistory), [callId, watchCall]);
  if (!history || history.status === 'ringing') return null;
  const declined = history.status === 'declined';
  const label = declined
    ? t('Interview declined')
    : history.answered
      ? t('Answered')
      : t('No answer');
  const duration = history.durationSeconds;
  const elapsed =
    duration === undefined
      ? ''
      : ` · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
  return (
    <View style={s.invitationMeta}>
      <Text
        accessible={false}
        style={[s.outcomeIcon, { color: declined || !history.answered ? '#FF9AA7' : '#78DDB0' }]}
      >
        {declined ? '×' : history.answered ? '✓' : '↙'}
      </Text>
      <Text style={s.invitationLabel}>
        {label}
        {elapsed}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  outcomeIcon: { fontSize: 17, fontWeight: '700' },
  pane: { flex: 1, backgroundColor: '#12141B' },
  muted: { color: colors.muted, textAlign: 'center' },
  empty: { flex: 1, padding: 20, gap: 6, alignItems: 'center', justifyContent: 'center' },
  emptyHeading: { fontSize: 16, fontWeight: '600', color: colors.text },
  list: { flex: 1 },
  timeline: { paddingHorizontal: 14, paddingVertical: 14 },
  messageRow: { flexDirection: 'row', gap: 4, borderRadius: 16 },
  bubbleColumn: { flex: 1 },
  selectionColumn: { width: 44, justifyContent: 'center' },
  selectionControl: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionPressed: { backgroundColor: '#BCB5FF14' },
  selectedRow: {
    backgroundColor: '#BCB5FF0E',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BCB5FF24',
  },
  bubble: {
    maxWidth: '86%',
    minWidth: 68,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    marginTop: 10,
    marginBottom: 2,
    borderRadius: 18,
  },
  out: { backgroundColor: '#443B67', alignSelf: 'flex-end', borderBottomRightRadius: 7 },
  incoming: { backgroundColor: '#232732', alignSelf: 'flex-start', borderBottomLeftRadius: 7 },
  joined: { marginTop: 2 },
  outAbove: { borderTopRightRadius: 6 },
  inAbove: { borderTopLeftRadius: 6 },
  invitationBubble: { paddingTop: 10, paddingBottom: 10 },
  invitation: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  invitationIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#14132160',
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationDetails: { flexShrink: 1 },
  invitationTitle: { color: colors.text, fontWeight: '600', fontSize: 15 },
  invitationMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    marginTop: 3,
  },
  invitationLabel: { color: '#D4CFE4', fontSize: 12, lineHeight: 17, flexShrink: 1 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  sender: { color: colors.accent, fontWeight: '600', fontSize: 12, marginBottom: 4 },
  metadata: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  stamp: {
    fontSize: 10,
    lineHeight: 14,
    color: '#C9C5D9',
    fontVariant: ['tabular-nums'],
  },
  date: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.input,
    color: colors.muted,
    fontSize: 11,
    marginTop: 16,
    marginBottom: 6,
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
