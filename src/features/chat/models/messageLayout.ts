import type { ChatMessage } from './chat';

/** Messages are newest first. A run never crosses a sender, date, or five-minute gap. */
export function continuesMessageRun(older: ChatMessage | undefined, newer: ChatMessage) {
  if (!older || older.fromId !== newer.fromId) return false;
  const elapsed = newer.time - older.time;
  return (
    elapsed >= 0 &&
    elapsed <= 5 * 60_000 &&
    new Date(older.time).toDateString() === new Date(newer.time).toDateString()
  );
}
