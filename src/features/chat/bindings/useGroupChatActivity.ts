import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import type { PrivateGroup } from '../../contacts/models/sharing';
import { useAppForeground } from '../../../shared/lifecycle/useAppForeground';

export function useGroupChatActivity(
  uid: string,
  groups: readonly PrivateGroup[],
  focused: boolean,
) {
  const { createGroupChatActivity } = useAuthDependencies();
  const foreground = useAppForeground();
  const model = useMemo(() => createGroupChatActivity(uid), [createGroupChatActivity, uid]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useEffect(() => {
    if (focused && foreground) model.sync(groups);
    else model.pause();
  }, [model, groups, focused, foreground]);
  useEffect(() => model.stop, [model]);
  return {
    entries: state.entries,
    retry: () => {
      if (focused && foreground) model.sync(groups, true);
    },
  };
}
