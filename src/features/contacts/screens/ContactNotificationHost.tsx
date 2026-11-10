import { MapUserCard } from '../views/MapUserCard';
import React from 'react';
import { useContactsSelection } from '../bindings/ContactsProvider';
import { selectContactOverlays } from '../viewmodels/contactSelectors';
import { shallowEqual } from '../../../shared/mvvm/shallowEqual';
import { ContactDialogs } from '../views/ContactDialogs';
import { Feedback } from '../../../shared/ui/Feedback';
import { usePersonChats } from '../../chat/bindings/usePersonChats';
import { openPersonChat } from '../../chat/screens/openPersonChat';
export function ContactNotificationHost() {
  const { state, commands } = useContactsSelection(selectContactOverlays, shallowEqual);
  const chats = usePersonChats();
  const personId = state.selectedUser?.id;
  const chat = personId ? chats.get(personId) : undefined;
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
          chat && personId
            ? () => {
                commands.closeMapUser();
                openPersonChat(personId);
              }
            : undefined
        }
      />
    </>
  );
}
