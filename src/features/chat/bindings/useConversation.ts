import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import type { ChatPeer } from '../models/chat';
import { useAppForeground } from '../../../shared/lifecycle/useAppForeground';
export function useConversation(uid: string, peer?: ChatPeer, enabled = true) {
  const { createChat } = useAuthDependencies();
  const foreground = useAppForeground();
  const model = useMemo(() => createChat(uid, peer), [createChat, uid, peer]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useEffect(() => {
    if (!uid || !enabled || !foreground) return;
    model.start();
    return model.stop;
  }, [model, uid, enabled, foreground]);
  return { state, commands: model };
}
