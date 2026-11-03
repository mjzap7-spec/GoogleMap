import { MapUserCard } from '../views/MapUserCard';
import React from 'react';
import { useContactsContext } from '../bindings/ContactsProvider';
import { ContactDialogs } from '../views/ContactDialogs';
export function ContactNotificationHost() {
  const { state, commands } = useContactsContext();
  return (
    <>
      <ContactDialogs state={state} commands={commands} />
      <MapUserCard state={state} commands={commands} />
    </>
  );
}
