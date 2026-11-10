import { TestUserCard } from '../../map/views/TestUserCard';
import { useSharing } from '../../contacts/bindings/SharingProvider';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { useCallback, useMemo, useState } from 'react';
import { Redirect, router, useIsFocused } from 'expo-router';
import { PageSurface } from '../../../shared/motion/PageSurface';
import { usePageTransition } from '../../../shared/motion/usePageTransition';
import { HomeView } from '../views/HomeView';
import { useSession } from '../bindings/useSession';
import { SessionLoadingView } from '../views/SessionLoadingView';
import { useContacts } from '../../contacts/bindings/useContacts';
import { useMap } from '../../map/bindings/useMap';
import { mapPeople, type MapPeopleFilter } from '../../map/models/mapPeople';
import { usePersonChats } from '../../chat/bindings/usePersonChats';
import { openPersonChat } from '../../chat/screens/openPersonChat';

/** Authentication and restoration are resolved by AuthNavigator before this page mounts. */
export function HomeScreen() {
  const { t } = useTranslation();

  const { state, retry } = useSession();
  const transition = usePageTransition();
  if (state.registrationProfilePending || state.profileRequired)
    return <Redirect href="/profile" />;
  if (state.user?.profileStatus === 'loading')
    return <SessionLoadingView message={t('Loading your profile...')} />;
  if (state.user?.profileStatus === 'error')
    return (
      <SessionLoadingView
        message={t('Your profile could not be loaded.')}
        error={state.error}
        onRetry={retry}
      />
    );
  return (
    <PageSurface transition={transition}>
      {state.user && <HomeContent key={state.user.id} error={state.error} />}
    </PageSurface>
  );
}

function HomeContent({ error }: { error: string }) {
  const mapActive = useIsFocused();
  const map = useMap();
  const contacts = useContacts();
  const sharing = useSharing();
  const personChats = usePersonChats();
  const [peopleFilter, setPeopleFilter] = useState<MapPeopleFilter>('all');
  const ownId = sharing.model.user.id;
  const testCount = map.state.testUserCount;
  const showNearby = contacts.state.showNearby;
  const locations = sharing.state.locations;
  const mapCommands = map.commands;
  const contactCommands = contacts.commands;
  const selectUser = useCallback(
    (id: string) => {
      if (testCount) {
        mapCommands.selectTestUser(id);
        return;
      }
      if (!showNearby) return;
      const location = locations.find((item) => item.id === id);
      if (location) contactCommands.selectSharedUser(location);
      else contactCommands.selectMapUser(id);
    },
    [testCount, showNearby, locations, mapCommands, contactCommands],
  );
  const { users, focus, sharedTrail } = useMemo(
    () =>
      mapPeople(
        contacts.state.showNearby,
        ownId,
        contacts.state.nearby,
        sharing.state.locations,
        sharing.state.focus,
        contacts.state.focus,
        contacts.state.contacts,
        peopleFilter,
      ),
    [
      contacts.state.showNearby,
      ownId,
      contacts.state.nearby,
      sharing.state.locations,
      sharing.state.focus,
      contacts.state.focus,
      contacts.state.contacts,
      peopleFilter,
    ],
  );
  return (
    <>
      <HomeView
        error={error}
        peopleFilter={peopleFilter}
        onPeopleFilter={setPeopleFilter}
        testCount={map.state.testUserCount}
        onStopTesting={() => map.commands.setTestUserCount(0)}
        tripGroup={
          sharing.state.groups.find((group) => group.id === sharing.state.tripGroupId)?.name
        }
        onStopTrip={sharing.model.stopTrip}
        onFollowTrip={(id) => {
          const trip = sharing.state.locations.find((row) => row.trip && row.id === id);
          if (contacts.state.showNearby && trip) sharing.model.focusLocation(trip);
        }}
        contacts={{
          ...contacts,
          personChats,
          onShowAll: () => router.navigate('/contacts'),
          onChat: (contact) => {
            const chat = contact.peerId && personChats.get(contact.peerId);
            if (chat && contact.peerId) openPersonChat(contact.peerId);
          },
          onEdit: (contact) =>
            router.push({ pathname: '/contact/[id]', params: { id: contact.id } }),
          onSelect: (contact) => {
            if (!contacts.commands.canLocateOnMap()) return;
            setPeopleFilter('all');
            map.commands.setTestUserCount(0);
            if (sharing.model.focusMember(contact.peerId)) return;
            sharing.model.clearFocus();
            void contacts.commands.locateContact(contact);
          },
        }}
        map={{
          ...map,
          active: mapActive,
          sharedTrail: testCount ? undefined : sharedTrail,
          onSelectUser: selectUser,
          users: map.state.testUserCount ? map.state.testUsers : users,
          focus: map.state.testUserCount ? null : focus,
        }}
      />
      <TestUserCard
        user={map.state.testUsers.find((user) => user.id === map.state.selectedTestUserId)}
        onClose={() => map.commands.selectTestUser('')}
      />
    </>
  );
}
