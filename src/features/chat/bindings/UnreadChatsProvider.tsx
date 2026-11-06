import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import { useContactsContext } from '../../contacts/bindings/ContactsProvider';
import { useSharing } from '../../contacts/bindings/SharingProvider';
import type { UnreadChatsViewModel } from '../viewmodels/UnreadChatsViewModel';

const Context = createContext<UnreadChatsViewModel | null>(null);
export function UnreadChatsProvider({ uid, children }: PropsWithChildren<{ uid: string }>) {
  const { createUnreadChats } = useAuthDependencies();
  const model = useMemo(() => createUnreadChats(uid), [createUnreadChats, uid]);
  const {
    state: { contacts },
  } = useContactsContext();
  const {
    state: { groups },
  } = useSharing();
  useEffect(() => {
    model.start();
    return model.stop;
  }, [model]);
  useEffect(() => model.sync(contacts, groups), [model, contacts, groups]);
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useUnreadChats() {
  const model = useContext(Context);
  if (!model) throw new Error('UnreadChatsProvider is required.');
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  return { state, model };
}
