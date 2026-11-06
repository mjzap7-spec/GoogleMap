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
import { useContactsContext } from './ContactsProvider';
import { useMapViewModel } from '../../map/bindings/MapProvider';
import type { SharingViewModel } from '../viewmodels/SharingViewModel';
const Context = createContext<SharingViewModel | null>(null);
export function SharingProvider({ user, children }: PropsWithChildren<{ user: AuthUser }>) {
  const { createSharing } = useAuthDependencies();
  const [model] = useState(() => createSharing(user));
  useActionNotices(model);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const {
    model: contacts,
    state: { showNearby },
  } = useContactsContext();
  const map = useMapViewModel();
  const mapState = useSyncExternalStore(map.subscribe, map.getSnapshot, map.getSnapshot);
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
