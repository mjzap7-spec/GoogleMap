import { useMemo } from 'react';
import { shallowEqual } from '../../../shared/mvvm/shallowEqual';
import { useContactsSelection } from '../../contacts/bindings/ContactsProvider';
import { useSharingGroups } from '../../contacts/bindings/SharingProvider';
import { selectContactDirectory } from '../../contacts/viewmodels/contactSelectors';
import { createConversationProjection } from '../models/conversationProjection';
import { personConversation } from '../models/personConversation';
import { useConversation } from './useConversation';
import { useGroupChatActivity } from './useGroupChatActivity';
import { useUnreadChats } from './UnreadChatsProvider';

/** Bind independent stores to the chat directory projection. Navigation stays in the screen. */
export function useChatDirectory(uid: string, focused: boolean, pendingPerson?: string) {
  const { state: contacts, commands } = useContactsSelection(selectContactDirectory, shallowEqual);
  const { state: sharing, model: groups } = useSharingGroups();
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
  const error =
    contacts.loadError ||
    inbox.state.error ||
    sharing.error ||
    (unread.failed || [...activity.entries.values()].some((entry) => entry.failed)
      ? 'Could not load chats. Please retry.'
      : '');
  return {
    rows,
    groups: sharing.groups,
    personEntry: !contacts.loadError && !inbox.state.error ? personEntry : undefined,
    loading: contacts.loading || inbox.state.loading,
    error,
    retry: () => {
      if (contacts.loadError) commands.retry();
      if (inbox.state.error) inbox.commands.start();
      if (sharing.error) groups.start();
      activity.retry();
      if (unread.failed) unreadModel.retry();
    },
  };
}
