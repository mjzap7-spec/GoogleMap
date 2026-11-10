import { useActionNotices } from '../../../shared/ui/Feedback';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Keyboard } from 'react-native';
import type { AuthUser } from '../../auth/models/auth';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import type { ContactsState, ContactsViewModel } from '../viewmodels/ContactsViewModel';
import { useMapViewModel } from '../../map/bindings/MapProvider';
import type { MapState } from '../../map/models/map';
import { useViewModelSelection } from '../../../shared/mvvm/useViewModelSelection';
import { shallowEqual } from '../../../shared/mvvm/shallowEqual';
const selectPosition = (state: Readonly<MapState>) => ({
  live: state.live,
  tracking: state.tracking,
});
const selectState = (state: Readonly<ContactsState>) => state;
function useContactsModel(user: AuthUser) {
  const { createContacts } = useAuthDependencies();
  const [model] = useState(() => createContacts(user.id));
  useActionNotices(model);
  const map = useMapViewModel();
  const mapState = useViewModelSelection(map, selectPosition, shallowEqual);
  const profileSyncPending = user.profileSyncPending === true;
  useEffect(() => {
    if (profileSyncPending) return;
    model.start();
    return model.dispose;
  }, [model, profileSyncPending]);
  useEffect(() => {
    if (!user.profileSyncPending) void model.registerUser(user);
  }, [model, user]);
  useEffect(() => {
    model.setPosition(mapState.live, mapState.tracking === 'tracking');
  }, [model, mapState.live, mapState.tracking]);
  const commands = useMemo(
    () => ({
      openForm: model.openForm,
      selectMapUser: model.selectMapUser,
      selectSharedUser: model.selectSharedUser,
      closeMapUser: model.closeMapUser,
      requestSelectedUser: model.requestSelectedUser,
      cancel: () => {
        model.cancel();
        if (!model.getSnapshot().formOpen) Keyboard.dismiss();
      },
      setEmail: model.setEmail,
      sendRequest: async () => {
        await model.sendRequest();
        if (!model.getSnapshot().formOpen) Keyboard.dismiss();
      },
      respond: model.respond,
      locateContact: model.locateContact,
      canLocateOnMap: model.canLocateOnMap,
      setShowNearby: model.setShowNearby,
      retryNearby: model.retryNearby,
      openInbox: model.openInbox,
      dismissEvent: model.dismissEvent,
      closeInbox: model.closeInbox,
      retry: model.start,
    }),
    [model],
  );
  // Context contains stable services only; each screen selects the state it displays.
  return useMemo(() => ({ commands, model }), [commands, model]);
}
type Value = ReturnType<typeof useContactsModel>;
const Context = createContext<Value | null>(null);
export function ContactsProvider({ user, children }: PropsWithChildren<{ user: AuthUser }>) {
  const value = useContactsModel(user);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useContactsModelContext() {
  const value = useContext(Context);
  if (!value) throw new Error('ContactsProvider is required.');
  return value;
}
export function useContactsSelection<Selection>(
  select: (state: Readonly<ContactsState>) => Selection,
  equal?: (previous: Selection, next: Selection) => boolean,
) {
  const value = useContactsModelContext();
  const state = useViewModelSelection(value.model, select, equal);
  return { ...value, state };
}
export function useContactsContext() {
  return useContactsSelection(selectState);
}
export type ContactCommands = Pick<ContactsViewModel, 'setPosition'>;
