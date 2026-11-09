import type { Contact } from '../../contacts/models/contact';
import type { PrivateGroup } from '../../contacts/models/sharing';
import { threadKey, type ChatPreview } from './chat';
import type { ChatSelection, GroupActivity } from './conversations';

export type PersonConversation =
  { status: 'loading' | 'error' | 'unavailable' } | { status: 'ready'; selection: ChatSelection };

/** Resolve a person shortcut against history, not just their current unread badge. */
export function personConversation(
  uid: string,
  personId: string,
  contacts: readonly Contact[],
  groups: readonly PrivateGroup[],
  previews: readonly ChatPreview[],
  activity: ReadonlyMap<string, GroupActivity>,
  counts: ReadonlyMap<string, number>,
): PersonConversation {
  if (personId === uid) return { status: 'unavailable' };
  const candidates: { selection: ChatSelection; unread: boolean; time: number }[] = [];
  for (const contact of contacts) {
    if (contact.peerId !== personId || !contact.requestId) continue;
    candidates.push({
      selection: { key: 'contact:' + contact.id },
      unread: (counts.get(threadKey({ peerId: personId, requestId: contact.requestId })) ?? 0) > 0,
      time: previews.find((preview) => preview.requestId === contact.requestId)?.time ?? 0,
    });
  }
  let pending = false;
  let failed = false;
  for (const group of groups) {
    if (!group.joinedIds.includes(uid) || !group.joinedIds.includes(personId)) continue;
    const key = threadKey({ groupId: group.id, memberId: personId });
    const entry = activity.get(key);
    pending ||= !entry;
    failed ||= !!entry?.failed;
    candidates.push({
      selection: { key, groupId: group.id },
      unread: (counts.get(key) ?? 0) > 0,
      time: entry?.latest?.time ?? 0,
    });
  }
  // An empty early snapshot must not win while a shared group's history is still loading.
  if (failed) return { status: 'error' };
  if (pending) return { status: 'loading' };
  candidates.sort(
    (a, b) =>
      Number(b.unread) - Number(a.unread) ||
      b.time - a.time ||
      a.selection.key.localeCompare(b.selection.key),
  );
  return candidates[0]
    ? { status: 'ready', selection: candidates[0].selection }
    : { status: 'unavailable' };
}
