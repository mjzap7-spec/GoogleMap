import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import { useContactsModelContext } from './ContactsProvider';
import type { Contact } from '../models/contact';
export function useContactEditor(userId: string, contactId: string) {
  const { createContactEditor } = useAuthDependencies();
  const { model: contacts } = useContactsModelContext();
  const [model] = useState(() =>
    createContactEditor(userId, contactId, (_, next, error) => {
      let previous: Contact | undefined;
      let initialized = false;
      const emit = () => {
        const state = contacts.getSnapshot();
        if (state.loadError) {
          error(new Error(state.loadError));
          return;
        }
        if (state.loading && !state.contacts.length) return;
        const selected = state.contacts.find((c) => c.id === contactId);
        if (initialized && selected === previous) return;
        previous = selected;
        initialized = true;
        next(selected ? [selected] : []);
      };
      const stop = contacts.subscribe(emit);
      emit();
      return stop;
    }),
  );
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useEffect(() => {
    model.start();
    return model.dispose;
  }, [model]);
  return {
    state,
    commands: {
      setNickname: model.setNickname,
      save: model.save,
      remove: model.remove,
      retry: model.start,
    },
  };
}
