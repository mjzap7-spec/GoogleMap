import React, { useMemo } from 'react';
import { useGroupRoster } from '../../chat/bindings/useGroupRoster';
import { memberConversations } from '../../chat/models/conversations';
import { router } from 'expo-router';
import { PrivateGroupsView } from '../views/PrivateGroupsView';
import { useSharing } from '../bindings/SharingProvider';
import { useContactsSelection } from '../bindings/ContactsProvider';
import { selectContacts } from '../viewmodels/contactSelectors';
import { useMapViewModel } from '../../map/bindings/MapProvider';
export function PrivateGroups({ unreadChats }: { unreadChats: ReadonlyMap<string, number> }) {
  const { state, model } = useSharing();
  const { state: contacts, commands: contactCommands } = useContactsSelection(selectContacts);
  const map = useMapViewModel();
  const group = state.groups.find(
    (g) => g.id === state.selectedId && g.joinedIds.includes(model.user.id),
  );
  const roster = useGroupRoster(model.user.id, group?.id ?? '');
  const members = useMemo(
    () => memberConversations(group, roster.members, contacts, model.user),
    [group, roster.members, contacts, model.user],
  );
  return (
    <PrivateGroupsView
      state={state}
      members={members}
      unreadChats={unreadChats}
      rosterError={roster.error}
      retryRoster={roster.retry}
      onChat={(group, member) =>
        router.push({ pathname: '/chat', params: member ? { group, member } : { group } })
      }
      commands={{
        setName: model.setName,
        create: model.create,
        join: model.join,
        leave: model.leave,
        invite: model.invite,
        selectGroup: model.selectGroup,
        startTrip: (group) => {
          model.startTrip(group);
          if (model.getSnapshot().tripGroupId === group.id && !map.getSnapshot().recording)
            map.toggleRecording();
        },
        stopTrip: model.stopTrip,
        start: model.start,
      }}
      contacts={contacts}
      userId={model.user.id}
      onLocate={(location) => {
        if (!contactCommands.canLocateOnMap()) return;
        map.setTestUserCount(0);
        model.focusLocation(location);
        router.navigate('/');
      }}
    />
  );
}
