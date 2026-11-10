import { useMapViewModel } from '../../map/bindings/MapProvider';
import { PrivateGroups } from './PrivateGroups';
import { useUnreadChats } from '../../chat/bindings/UnreadChatsProvider';
import { usePersonChats } from '../../chat/bindings/usePersonChats';
import { openPersonChat } from '../../chat/screens/openPersonChat';
import { useSharingGroups } from '../bindings/SharingProvider';
import React, { useRef, useEffect } from 'react';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useContactsSelection } from '../bindings/ContactsProvider';
import { selectContactList } from '../viewmodels/contactSelectors';
import { shallowEqual } from '../../../shared/mvvm/shallowEqual';
import { ManageContactsView } from '../views/ManageContactsView';
import { PageSurface } from '../../../shared/motion/PageSurface';
import { usePageTransition } from '../../../shared/motion/usePageTransition';
export function ManageContactsScreen() {
  const { state, commands, model } = useContactsSelection(selectContactList, shallowEqual);
  const map = useMapViewModel();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const sharing = useSharingGroups();
  const personChats = usePersonChats();
  const {
    state: { counts },
  } = useUnreadChats();
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
        tab={section === 'groups' ? 'groups' : 'contacts'}
        setTab={(tab) => router.setParams({ section: tab })}
        groups={<PrivateGroups unreadChats={counts} />}
        invitations={
          sharing.state.groups.filter((group) => !group.joinedIds.includes(sharing.model.user.id))
            .length
        }
        onBack={() => transition.navigate(() => router.navigate('/'))}
        contacts={{
          state,
          personChats,
          commands,
          onChat: (contact) => {
            const chat = contact.peerId && personChats.get(contact.peerId);
            const personId = contact.peerId;
            if (chat && personId) transition.navigate(() => openPersonChat(personId));
          },
          onEdit: (contact) =>
            transition.navigate(() =>
              router.push({ pathname: '/contact/[id]', params: { id: contact.id } }),
            ),
          onSelect: async (contact) => {
            if (!commands.canLocateOnMap()) return;
            map.setTestUserCount(0);
            if (sharing.model.focusMember(contact.peerId)) {
              transition.navigate(() => router.navigate('/'));
              return;
            }
            sharing.model.clearFocus();
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
