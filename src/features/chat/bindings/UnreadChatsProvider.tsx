import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { useViewModelSelection } from '../../../shared/mvvm/useViewModelSelection';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import { useContactsSelection } from '../../contacts/bindings/ContactsProvider';
import { selectContacts } from '../../contacts/viewmodels/contactSelectors';
import { useSharingGroups } from '../../contacts/bindings/SharingProvider';
import type { UnreadChatsViewModel } from '../viewmodels/UnreadChatsViewModel';

const Context = createContext<UnreadChatsViewModel | null>(null);
export function UnreadChatsProvider({ uid, children }: PropsWithChildren<{ uid: string }>) {
  const { createUnreadChats } = useAuthDependencies();
  const model = useMemo(() => createUnreadChats(uid), [createUnreadChats, uid]);
  const { state: contacts } = useContactsSelection(selectContacts);
  const {
    state: { groups },
  } = useSharingGroups();
  useEffect(() => {
    model.start();
    return model.stop;
  }, [model]);
  useEffect(() => model.sync(contacts, groups), [model, contacts, groups]);
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useUnreadChatsModel() {
  const model = useContext(Context);
  if (!model) throw new Error('UnreadChatsProvider is required.');
  return model;
}
type UnreadState = ReturnType<UnreadChatsViewModel['getSnapshot']>;
const selectTotal = (state: UnreadState) => state.total;
const selectCounts = (state: UnreadState) => state.counts;

export function useUnreadTotal() {
  return useViewModelSelection(useUnreadChatsModel(), selectTotal);
}
export function useUnreadCounts() {
  return useViewModelSelection(useUnreadChatsModel(), selectCounts);
}
export function useUnreadChats() {
  const model = useUnreadChatsModel();
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  return { state, model };
}
