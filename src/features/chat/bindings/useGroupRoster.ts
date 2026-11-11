import { useMemo, useSyncExternalStore, useEffect } from 'react';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import { useAppForeground } from '../../../shared/lifecycle/useAppForeground';
export function useGroupRoster(uid: string, groupId: string) {
  const { createGroupRoster } = useAuthDependencies();
  const foreground = useAppForeground();
  const model = useMemo(() => createGroupRoster(uid, groupId), [createGroupRoster, uid, groupId]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useEffect(() => {
    if (!foreground) return;
    model.start();
    return model.stop;
  }, [model, foreground]);
  return {
    ...state,
    retry: () => {
      if (foreground) model.start();
    },
  };
}
