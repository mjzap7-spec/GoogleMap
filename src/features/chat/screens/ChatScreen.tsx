import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Keyboard, useWindowDimensions } from 'react-native';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useSession } from '../../auth/bindings/useSession';
import { useContactsSelection } from '../../contacts/bindings/ContactsProvider';
import { selectContactDirectory } from '../../contacts/viewmodels/contactSelectors';
import { shallowEqual } from '../../../shared/mvvm/shallowEqual';
import { useSharingGroups } from '../../contacts/bindings/SharingProvider';
import { resolveConversation, memberKey, type ChatSelection } from '../models/conversations';
import { createConversationProjection } from '../models/conversationProjection';
import { useGroupChatActivity } from '../bindings/useGroupChatActivity';
import { useConversation } from '../bindings/useConversation';
import { useConversationRead } from '../bindings/useConversationRead';
import { useUnreadChats } from '../bindings/UnreadChatsProvider';
import { ChatView } from '../views/ChatView';
import { MessagePane } from '../views/MessagePane';
import type { ChatPeer } from '../models/chat';
import { personConversation } from '../models/personConversation';
import { useInterviewModel } from '../../interviews/bindings/InterviewsProvider';
import { interviewTarget } from '../../interviews/models/interview';

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
  const onRead = useConversationRead(peer, focused, model, commands.markVisibleRead);
  return (
    <MessagePane
      uid={uid}
      peerName={peerName}
      optionsRequest={optionsRequest}
      state={state}
      commands={commands}
      groupRoom={'senderName' in peer}
      onRead={onRead}
    />
  );
}
export function ChatScreen() {
  const { id, group, member, person } = useLocalSearchParams<{
    id?: string;
    group?: string;
    member?: string;
    person?: string;
  }>();
  return (
    <ChatWorkspace
      key={JSON.stringify([id, group, member, person])}
      initialPerson={person}
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
  initialPerson,
}: {
  initialKey?: string;
  initialGroup?: string;
  initialPerson?: string;
}) {
  const {
    state: { user },
  } = useSession();
  const { state: contacts, commands } = useContactsSelection(selectContactDirectory, shallowEqual);
  const { state: sharing, model: groups } = useSharingGroups();
  const uid = user?.id ?? '';
  const interviews = useInterviewModel();
  const focused = useIsFocused();
  const compact = useWindowDimensions().width < 640;
  const [listOpen, setListOpen] = useState(!initialKey && !initialPerson);
  const [pendingPerson, setPendingPerson] = useState(initialPerson);
  const [optionsRequest, setOptionsRequest] = useState(0);
  const inbox = useConversation(uid, undefined, focused);
  const activity = useGroupChatActivity(uid, sharing.groups, focused);
  const { state: unread, model: unreadModel } = useUnreadChats();
  const projectConversations = useMemo(() => createConversationProjection(), []);
  const rows = useMemo(
    () =>
      projectConversations(
        uid,
        contacts.contacts,
        sharing.groups,
        inbox.state.previews,
        activity.entries,
        unread.counts,
      ),
    [
      projectConversations,
      uid,
      contacts.contacts,
      sharing.groups,
      inbox.state.previews,
      activity.entries,
      unread.counts,
    ],
  );
  const [choice, setChoice] = useState<ChatSelection | undefined>(
    initialKey ? { key: initialKey, groupId: initialGroup } : undefined,
  );
  const personEntry = useMemo(
    () =>
      pendingPerson && !contacts.loading && sharing.membershipsLoaded && !inbox.state.loading
        ? personConversation(
            uid,
            pendingPerson,
            contacts.contacts,
            sharing.groups,
            inbox.state.previews,
            activity.entries,
            unread.counts,
          )
        : undefined,
    [
      pendingPerson,
      uid,
      contacts.loading,
      contacts.contacts,
      sharing.membershipsLoaded,
      sharing.groups,
      inbox.state.loading,
      inbox.state.previews,
      activity.entries,
      unread.counts,
    ],
  );
  // Resolve once before mounting the transcript; live read receipts must not switch it later.
  if (!contacts.loadError && !inbox.state.error) {
    if (personEntry?.status === 'ready') {
      setChoice(personEntry.selection);
      setPendingPerson(undefined);
    } else if (personEntry?.status === 'unavailable') {
      setPendingPerson(undefined);
      setListOpen(true);
    }
  }
  const selected = resolveConversation(rows, choice);
  const openingPerson = !!pendingPerson;
  const showingList = compact && (listOpen || (!selected && !openingPerson));
  const showList = useCallback(() => {
    Keyboard.dismiss();
    setPendingPerson(undefined);
    setListOpen(true);
  }, []);
  const select = useCallback((next: ChatSelection, openThread = true) => {
    setPendingPerson(undefined);
    setOptionsRequest(0);
    setChoice(next);
    setListOpen(!openThread);
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
      onInterview={
        peer && !('senderName' in peer)
          ? (mode) => {
              Keyboard.dismiss();
              const target = interviewTarget(
                peer,
                selected?.row.name ?? '',
                selected?.row.avatarUrl,
              );
              if (target) interviews.startInterview(target, mode);
            }
          : undefined
      }
      rows={rows}
      compact={compact}
      showingList={showingList}
      openingPerson={openingPerson}
      onShowList={showList}
      onThreadOptions={() => {
        Keyboard.dismiss();
        setOptionsRequest((value) => value + 1);
      }}
      selected={selected?.row}
      onSelect={select}
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
