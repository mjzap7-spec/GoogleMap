import React, { useRef, useEffect } from 'react';
import { router, useIsFocused } from 'expo-router';
import { useContactsContext } from '../bindings/ContactsProvider';
import { ManageContactsView } from '../views/ManageContactsView';
import { PageSurface } from '../../../shared/motion/PageSurface';
import { usePageTransition } from '../../../shared/motion/usePageTransition';
export function ManageContactsScreen() {
  const { state, commands, model } = useContactsContext();
  const transition = usePageTransition();
  const focused = useIsFocused();
  const active = useRef(focused);
  useEffect(() => {
    active.current = focused;
    return () => {
      active.current = false;
    };
  }, [focused]);
  return (
    <PageSurface transition={transition}>
      <ManageContactsView
        onBack={() => transition.navigate(() => router.navigate('/'))}
        contacts={{
          state,
          commands,
          onEdit: (contact) =>
            transition.navigate(() =>
              router.push({ pathname: '/contact/[id]', params: { id: contact.id } }),
            ),
          onSelect: async (contact) => {
            await commands.locateContact(contact);
            if (
              active.current &&
              model.getSnapshot().focus?.id === contact.peerId &&
              !model.getSnapshot().error
            )
              transition.navigate(() => router.navigate('/'));
          },
        }}
      />
    </PageSurface>
  );
}
