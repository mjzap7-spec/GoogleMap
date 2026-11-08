import { compareTime, type ReadTime } from './chat';

/** Device-only visibility. No message body or credential is stored here. */
export interface LocalThreadHistory {
  hiddenIds: readonly string[];
  clearedThrough?: ReadTime;
}
export type LocalHistory = Readonly<Record<string, LocalThreadHistory>>;
export interface LocalChatHistory {
  observe(uid: string, next: (history: LocalHistory) => void, fail: () => void): () => void;
  hide(uid: string, thread: string, ids: readonly string[]): Promise<void>;
  clear(
    uid: string,
    thread: string,
    through: ReadTime | undefined,
    ids: readonly string[],
  ): Promise<void>;
}
export const emptyThread: LocalThreadHistory = { hiddenIds: [] };

export function newerTime(a?: ReadTime, b?: ReadTime) {
  return !a ? b : !b || compareTime(a, b) >= 0 ? a : b;
}

export function historyFilter(history: LocalThreadHistory = emptyThread) {
  const hidden = new Set(history.hiddenIds);
  return (message: { id: string; createdAt?: ReadTime }) =>
    hidden.has(message.id) ||
    (!!history.clearedThrough &&
      !!message.createdAt &&
      compareTime(message.createdAt, history.clearedThrough) <= 0);
}
