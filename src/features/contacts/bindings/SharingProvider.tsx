import { useActionNotices } from '../../../shared/ui/Feedback';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import type { AuthUser } from '../../auth/models/auth';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import { useContactsSelection } from './ContactsProvider';
import { selectNearbyEnabled } from '../viewmodels/contactSelectors';
import { useMapViewModel } from '../../map/bindings/MapProvider';
import type { SharingState, SharingViewModel } from '../viewmodels/SharingViewModel';
import { useViewModelSelection } from '../../../shared/mvvm/useViewModelSelection';
import { shallowEqual } from '../../../shared/mvvm/shallowEqual';
import type { MapState } from '../../map/models/map';
const selectPosition = (state: Readonly<MapState>) => ({
  live: state.live,
  trail: state.trail,
  tracking: state.tracking,
});
const Context = createContext<SharingViewModel | null>(null);
export function SharingProvider({ user, children }: PropsWithChildren<{ user: AuthUser }>) {
  const { createSharing } = useAuthDependencies();
  const [model] = useState(() => createSharing(user));
  useActionNotices(model);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const { model: contacts, state: showNearby } = useContactsSelection(selectNearbyEnabled);
  const map = useMapViewModel();
  const mapState = useViewModelSelection(map, selectPosition, shallowEqual);
  const profileSyncPending = user.profileSyncPending === true;
  useEffect(() => {
    if (!showNearby) model.clearFocus();
  }, [model, showNearby]);
  useEffect(() => {
    if (profileSyncPending) return;
    model.start();
    return model.dispose;
  }, [model, profileSyncPending]);
  useEffect(() => {
    model.setUser(user);
  }, [model, user]);
  useEffect(() => {
    contacts.setNearbyVisibility(state.ready && state.preferences.nearby);
  }, [contacts, state.ready, state.preferences.nearby]);
  useEffect(() => {
    contacts.refreshSharedUser(state.locations);
  }, [contacts, state.locations]);
  useEffect(() => {
    model.setPosition(mapState.live, mapState.trail, mapState.tracking === 'tracking');
  }, [model, mapState.live, mapState.trail, mapState.tracking]);
  useEffect(() => {
    if (!state.tripGroupId || mapState.tracking !== 'tracking') return;
    map.refreshTripFix();
    const timer = setInterval(map.refreshTripFix, 30000);
    return () => clearInterval(timer);
  }, [map, mapState.tracking, state.tripGroupId]);
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useSharing() {
  const model = useContext(Context);
  if (!model) throw new Error('SharingProvider is required.');
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  return { state, model };
}

const selectGroups = (state: Readonly<SharingState>) => ({
  groups: state.groups,
  membershipsLoaded: state.membershipsLoaded,
  error: state.membershipError,
});
const sameGroups = (a: ReturnType<typeof selectGroups>, b: ReturnType<typeof selectGroups>) =>
  a.groups === b.groups && a.membershipsLoaded === b.membershipsLoaded && a.error === b.error;

/** Chat and contact lists must not re-render for every shared GPS fix. */
export function useSharingGroups() {
  const model = useContext(Context);
  if (!model) throw new Error('SharingProvider is required.');
  const state = useViewModelSelection(model, selectGroups, sameGroups);
  return { state, model };
}
