import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, BackHandler, Keyboard, Platform, useWindowDimensions } from 'react-native';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../auth/bindings/useSession';
import { useContactsContext } from '../../contacts/bindings/ContactsProvider';
import { useSharing } from '../../contacts/bindings/SharingProvider';
import {
  conversationList,
  resolveConversation,
  memberKey,
  type ChatSelection,
} from '../models/conversations';
import { useGroupChatActivity } from '../bindings/useGroupChatActivity';
import { useConversation } from '../bindings/useConversation';
import { useUnreadChats } from '../bindings/UnreadChatsProvider';
import { ChatView } from '../views/ChatView';
import { MessagePane } from '../views/MessagePane';
import type { ChatPeer, ReadTime } from '../models/chat';

function foreground() {
  if (Platform.OS === 'web')
    return typeof document !== 'undefined' && document.visibilityState === 'visible';
  return AppState.currentState === 'active';
}
function observeForeground(notify: () => void) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', notify);
    return () => document.removeEventListener('visibilitychange', notify);
  }
  const sub = AppState.addEventListener('change', notify);
  return () => sub.remove();
}
function Thread({
  uid,
  peer,
  focused,
  peerName,
  optionsRequest,
}: {
  uid: string;
  peer: ChatPeer;
  focused: boolean;
  peerName: string;
  optionsRequest: number;
}) {
  const { state, commands } = useConversation(uid, peer, focused);
  const { model } = useUnreadChats();
  const active = useSyncExternalStore(observeForeground, foreground, () => false);
  const onRead = useCallback(
    (through: ReadTime) => {
      if (focused && foreground()) {
        model.markRead(peer, through);
        commands.markVisibleRead(through);
      }
    },
    [focused, model, peer, commands],
  );
  return (
    <MessagePane
      uid={uid}
      peerName={peerName}
      optionsRequest={optionsRequest}
      state={state}
      commands={commands}
      groupRoom={'senderName' in peer}
      onRead={focused && active ? onRead : undefined}
    />
  );
}
export function ChatScreen() {
  const { id, group, member } = useLocalSearchParams<{
    id?: string;
    group?: string;
    member?: string;
  }>();
  return (
    <ChatWorkspace
      key={JSON.stringify([id, group, member])}
      initialKey={
        group
          ? member
            ? memberKey(group, member)
            : 'group:' + group
          : id
            ? 'contact:' + id
            : undefined
      }
      initialGroup={group}
    />
  );
}

function ChatWorkspace({
  initialKey,
  initialGroup,
}: {
  initialKey?: string;
  initialGroup?: string;
}) {
  const {
    state: { user },
  } = useSession();
  const { state: contacts, commands } = useContactsContext();
  const { state: sharing, model: groups } = useSharing();
  const uid = user?.id ?? '';
  const focused = useIsFocused();
  const compact = useWindowDimensions().width < 640;
  const [listOpen, setListOpen] = useState(!initialKey);
  const [optionsRequest, setOptionsRequest] = useState(0);
  const inbox = useConversation(uid, undefined, focused);
  const activity = useGroupChatActivity(uid, sharing.groups, focused);
  const { state: unread, model: unreadModel } = useUnreadChats();
  const rows = useMemo(
    () =>
      conversationList(
        uid,
        contacts.contacts,
        sharing.groups,
        inbox.state.previews,
        activity.entries,
        unread.counts,
      ),
    [uid, contacts.contacts, sharing.groups, inbox.state.previews, activity.entries, unread.counts],
  );
  const [choice, setChoice] = useState<ChatSelection | undefined>(
    initialKey ? { key: initialKey, groupId: initialGroup } : undefined,
  );
  const selected = resolveConversation(rows, choice);
  const showingList = compact && (listOpen || !selected);
  const showList = useCallback(() => {
    Keyboard.dismiss();
    setListOpen(true);
  }, []);
  useEffect(() => {
    if (!focused || !compact || showingList) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      showList();
      return true;
    });
    return () => subscription.remove();
  }, [focused, compact, showingList, showList]);
  if (choice && selected?.groupId && selected.groupId !== choice.groupId) {
    setChoice({ ...choice, groupId: selected.groupId });
  }
  const target = selected?.target;
  const groupId = target && 'groupId' in target ? target.groupId : undefined;
  const requestId = target && 'requestId' in target ? target.requestId : undefined;
  const peerId = target && 'peerId' in target ? target.peerId : undefined;
  const memberId = target && 'memberId' in target ? target.memberId : undefined;
  const senderName = user?.fullName ?? '';
  const peer = useMemo(
    () =>
      groupId
        ? memberId
          ? { groupId, memberId }
          : { groupId, senderName }
        : peerId && requestId
          ? { peerId, requestId }
          : undefined,
    [groupId, memberId, senderName, peerId, requestId],
  );
  return (
    <ChatView
      rows={rows}
      compact={compact}
      showingList={showingList}
      onShowList={showList}
      onThreadOptions={() => {
        Keyboard.dismiss();
        setOptionsRequest((value) => value + 1);
      }}
      selected={selected?.row}
      onSelect={(next, openThread = true) => {
        setOptionsRequest(0);
        setChoice(next);
        setListOpen(!openThread);
      }}
      expandedGroup={sharing.groups.find((g) => g.id === selected?.groupId)}
      transcript={
        peer &&
        choice && (
          <Thread
            key={choice.key}
            uid={uid}
            peer={peer}
            peerName={selected?.row.name ?? ''}
            optionsRequest={optionsRequest}
            focused={focused && !showingList}
          />
        )
      }
      loading={contacts.loading || inbox.state.loading}
      error={
        contacts.loadError ||
        inbox.state.error ||
        sharing.error ||
        (unread.failed || [...activity.entries.values()].some((entry) => entry.failed)
          ? 'Could not load chats. Please retry.'
          : '')
      }
      onRetry={() => {
        if (contacts.loadError) commands.retry();
        if (inbox.state.error) inbox.commands.start();
        if (sharing.error) groups.start();
        activity.retry();
        if (unread.failed) unreadModel.retry();
      }}
      onBack={() =>
        compact && !showingList
          ? showList()
          : router.canGoBack()
            ? router.back()
            : router.navigate('/')
      }
      onContacts={() => router.navigate('/contacts')}
    />
  );
}
