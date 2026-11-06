import type { Contact } from '../../contacts/models/contact';
import type { PrivateGroup } from '../../contacts/models/sharing';
import { threadKey } from './chat';

export interface PersonChat {
  unread: number;
  target: { contactId: string } | { groupId: string; memberId: string };
}

/** Count each person's private threads once and prefer an unread thread when opening chat. */
export function personChats(
  uid: string,
  contacts: readonly Contact[],
  groups: readonly PrivateGroup[],
  counts: ReadonlyMap<string, number>,
): ReadonlyMap<string, PersonChat> {
  const people = new Map<string, PersonChat>();
  const seen = new Set<string>();
  const add = (peerId: string, key: string, target: PersonChat['target']) => {
    if (peerId === uid || seen.has(key)) return;
    seen.add(key);
    const unread = counts.get(key) ?? 0;
    const previous = people.get(peerId);
    people.set(peerId, {
      unread: (previous?.unread ?? 0) + unread,
      target: !previous || (!previous.unread && unread) ? target : previous.target,
    });
  };
  for (const contact of contacts) {
    if (contact.peerId && contact.requestId)
      add(contact.peerId, threadKey({ peerId: contact.peerId, requestId: contact.requestId }), {
        contactId: contact.id,
      });
  }
  for (const group of groups) {
    if (!group.joinedIds.includes(uid)) continue;
    for (const memberId of group.joinedIds)
      add(memberId, threadKey({ groupId: group.id, memberId }), { groupId: group.id, memberId });
  }
  return people;
}
