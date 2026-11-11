import { useCallback, useLayoutEffect } from 'react';
import { isAppForeground, useAppForeground } from '../../../shared/lifecycle/useAppForeground';
import type { ChatPeer, ReadTime } from '../models/chat';
import type { UnreadChatsViewModel } from '../viewmodels/UnreadChatsViewModel';

/** Screen visibility controls badges; actual message visibility advances read receipts. */
export function useConversationRead(
  peer: ChatPeer,
  focused: boolean,
  model: UnreadChatsViewModel,
  markVisibleRead: (through: ReadTime) => void,
) {
  const active = useAppForeground();
  useLayoutEffect(() => {
    if (focused && active) return model.view(peer);
  }, [focused, active, model, peer]);
  const onRead = useCallback(
    (through: ReadTime) => {
      if (focused && isAppForeground()) {
        model.markRead(peer, through);
        markVisibleRead(through);
      }
    },
    [focused, model, peer, markVisibleRead],
  );
  return focused && active ? onRead : undefined;
}
