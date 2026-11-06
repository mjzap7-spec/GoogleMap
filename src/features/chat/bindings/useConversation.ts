import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import type { ChatPeer } from '../models/chat';
export function useConversation(uid: string, peer?: ChatPeer, enabled = true) {
  const { createChat } = useAuthDependencies();
  const model = useMemo(() => createChat(uid, peer), [createChat, uid, peer]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useEffect(() => {
    if (!uid || !enabled) return;
    model.start();
    return model.stop;
  }, [model, uid, enabled]);
  return { state, commands: model };
}
