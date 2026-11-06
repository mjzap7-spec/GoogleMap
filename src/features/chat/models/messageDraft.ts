export const MAX_MESSAGE_LENGTH = 2000;
export interface DraftSelection {
  start: number;
  end: number;
}

/** Native selection offsets use UTF-16, like JavaScript string slicing. */
export function insertEmoji(draft: string, emoji: string, selection: DraftSelection) {
  let start = Math.max(0, Math.min(draft.length, selection.start));
  let end = Math.max(start, Math.min(draft.length, selection.end));
  const splitsSurrogate = (position: number) =>
    position > 0 &&
    position < draft.length &&
    /[\uD800-\uDBFF]/.test(draft[position - 1]) &&
    /[\uDC00-\uDFFF]/.test(draft[position]);
  // A stale caret must never split an existing emoji's surrogate pair.
  if (start === end && splitsSurrogate(start)) start = end = start + 1;
  else {
    if (splitsSurrogate(start)) start--;
    if (splitsSurrogate(end)) end++;
  }
  const text = draft.slice(0, start) + emoji + draft.slice(end);
  if (text.length > MAX_MESSAGE_LENGTH) return;
  const caret = start + emoji.length;
  return { text, selection: { start: caret, end: caret } };
}
