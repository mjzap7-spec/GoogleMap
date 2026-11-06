import { useMemo, useSyncExternalStore, useEffect } from 'react';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
export function useGroupRoster(uid: string, groupId: string) {
  const { createGroupRoster } = useAuthDependencies();
  const model = useMemo(() => createGroupRoster(uid, groupId), [createGroupRoster, uid, groupId]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useEffect(() => {
    model.start();
    return model.stop;
  }, [model]);
  return { ...state, retry: model.start };
}
