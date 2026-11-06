import { useActionNotices } from '../../../shared/ui/Feedback';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { Keyboard } from 'react-native';
import type { AuthUser } from '../../auth/models/auth';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import type { ContactsViewModel } from '../viewmodels/ContactsViewModel';
import { useMapViewModel } from '../../map/bindings/MapProvider';
function useContactsModel(user: AuthUser) {
  const { createContacts } = useAuthDependencies();
  const [model] = useState(() => createContacts(user.id));
  useActionNotices(model);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const map = useMapViewModel();
  const mapState = useSyncExternalStore(map.subscribe, map.getSnapshot, map.getSnapshot);
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
  return useMemo(() => ({ state, commands, model }), [state, commands, model]);
}
type Value = ReturnType<typeof useContactsModel>;
const Context = createContext<Value | null>(null);
export function ContactsProvider({ user, children }: PropsWithChildren<{ user: AuthUser }>) {
  const value = useContactsModel(user);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useContactsContext() {
  const value = useContext(Context);
  if (!value) throw new Error('ContactsProvider is required.');
  return value;
}
export type ContactCommands = Pick<ContactsViewModel, 'setPosition'>;
