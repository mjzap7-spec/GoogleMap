import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
export function useContactEditor(userId: string, contactId: string) {
  const { createContactEditor } = useAuthDependencies();
  const [model] = useState(() => createContactEditor(userId, contactId));
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
