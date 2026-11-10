import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import type { ChatPeer, ReadTime } from '../models/chat';
import type { UnreadChatsViewModel } from '../viewmodels/UnreadChatsViewModel';

function foreground() {
  if (Platform.OS === 'web')
    return typeof document !== 'undefined' && document.visibilityState === 'visible';
  return AppState.currentState === 'active';
}
function observeForeground(notify: () => void) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', notify);
    return () => document.removeEventListener('visibilitychange', notify);
  }
  const subscription = AppState.addEventListener('change', notify);
  return () => subscription.remove();
}

/** Screen visibility controls badges; actual message visibility advances read receipts. */
export function useConversationRead(
  peer: ChatPeer,
  focused: boolean,
  model: UnreadChatsViewModel,
  markVisibleRead: (through: ReadTime) => void,
) {
  const active = useSyncExternalStore(observeForeground, foreground, () => false);
  useLayoutEffect(() => {
    if (focused && active) return model.view(peer);
  }, [focused, active, model, peer]);
  const onRead = useCallback(
    (through: ReadTime) => {
      if (focused && foreground()) {
        model.markRead(peer, through);
        markVisibleRead(through);
      }
    },
    [focused, model, peer, markVisibleRead],
  );
  return focused && active ? onRead : undefined;
}
