import { MapUserCard } from '../views/MapUserCard';
import React from 'react';
import { useContactsContext } from '../bindings/ContactsProvider';
import { ContactDialogs } from '../views/ContactDialogs';
import { Feedback } from '../../../shared/ui/Feedback';
import { usePersonChats } from '../../chat/bindings/usePersonChats';
import { openPersonChat } from '../../chat/screens/openPersonChat';
export function ContactNotificationHost() {
  const { state, commands } = useContactsContext();
  const chats = usePersonChats();
  const chat = state.selectedUser && chats.get(state.selectedUser.id);
  return (
    <>
      <Feedback
        source="contacts"
        error={state.error}
        visible={!state.formOpen && !state.inboxOpen}
      />
      <ContactDialogs state={state} commands={commands} />
      <MapUserCard
        state={state}
        commands={commands}
        unread={chat?.unread ?? 0}
        onChat={
          chat
            ? () => {
                commands.closeMapUser();
                openPersonChat(chat);
              }
            : undefined
        }
      />
    </>
  );
}
