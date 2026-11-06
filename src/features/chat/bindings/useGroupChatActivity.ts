import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import type { PrivateGroup } from '../../contacts/models/sharing';

export function useGroupChatActivity(
  uid: string,
  groups: readonly PrivateGroup[],
  focused: boolean,
) {
  const { createGroupChatActivity } = useAuthDependencies();
  const model = useMemo(() => createGroupChatActivity(uid), [createGroupChatActivity, uid]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useEffect(() => {
    if (focused) model.sync(groups);
    else model.stop();
  }, [model, groups, focused]);
  useEffect(() => model.stop, [model]);
  return { entries: state.entries, retry: () => model.sync(groups, true) };
}
