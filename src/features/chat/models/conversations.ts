import type { Contact } from '../../contacts/models/contact';
import type { PrivateGroup } from '../../contacts/models/sharing';
import { threadKey, type ChatMessage, type ChatPreview, type MemberCard } from './chat';
import type { AuthUser } from '../../auth/models/auth';
export interface Conversation {
  key: string;
  name: string;
  avatarUrl?: string | null;
  preview?: Pick<ChatPreview, 'time' | 'text'>;
  activityTime?: number;
  unread?: number;
  members?: MemberConversation[];
  target:
    | { groupId: string }
    | { peerId: string; requestId: string }
    | { groupId: string; memberId: string };
}
export function memberKey(groupId: string, memberId: string) {
  return threadKey({ groupId, memberId });
}
export interface MemberConversation extends Conversation {
  target: { groupId: string; memberId: string };
  contact?: { key: string; target: { peerId: string; requestId: string } };
  openContact?: boolean;
}
export interface GroupActivity {
  latest?: ChatMessage;
  cards?: readonly MemberCard[];
  failed?: boolean;
}
function byActivity(a: Conversation, b: Conversation) {
  return (
    (b.activityTime ?? 0) - (a.activityTime ?? 0) ||
    a.name.localeCompare(b.name) ||
    a.key.localeCompare(b.key)
  );
}
function memberRow(
  groupId: string,
  id: string,
  contact?: Contact,
  card?: MemberCard,
  own?: AuthUser,
): MemberConversation {
  return {
    key: memberKey(groupId, id),
    name: contact?.name ?? own?.fullName ?? card?.name ?? '',
    avatarUrl: own?.avatarUrl ?? card?.avatarUrl ?? contact?.avatarUrl,
    target: { groupId, memberId: id },
  };
}
export function memberConversations(
  group: PrivateGroup | undefined,
  cards: readonly MemberCard[],
  contacts: readonly Contact[],
  self: AuthUser | null,
  { includeSelf = true } = {},
): MemberConversation[] {
  if (!group || !self || !group.joinedIds.includes(self.id)) return [];
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const contactsByPeer = new Map(contacts.map((contact) => [contact.peerId, contact]));
  return group.joinedIds
    .filter((id) => includeSelf || id !== self.id)
    .map((id) => {
      const own = id === self.id ? self : undefined;
      return memberRow(group.id, id, contactsByPeer.get(id), cardsById.get(id), own);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
export function conversationList(
  uid: string,
  contacts: readonly Contact[],
  groups: readonly PrivateGroup[],
  previews: readonly ChatPreview[],
  activity: ReadonlyMap<string, GroupActivity> = new Map(),
  counts: ReadonlyMap<string, number> = new Map(),
): Conversation[] {
  const recent = new Map(previews.map((p) => [p.requestId, p]));
  const joined = groups.filter((g) => g.joinedIds.includes(uid));
  const groupedIds = new Set(joined.flatMap((g) => g.joinedIds));
  const byPeer = new Map(contacts.map((c) => [c.peerId, c]));
  const people = contacts.flatMap((c): Conversation[] =>
    c.peerId && c.peerId !== uid && c.requestId && !groupedIds.has(c.peerId)
      ? [
          {
            key: 'contact:' + c.id,
            name: c.name,
            avatarUrl: c.avatarUrl,
            unread: counts.get(threadKey({ peerId: c.peerId, requestId: c.requestId })) ?? 0,
            preview: recent.get(c.requestId),
            activityTime: recent.get(c.requestId)?.time,
            target: { peerId: c.peerId, requestId: c.requestId },
          },
        ]
      : [],
  );
  const rooms = joined.map((group): Conversation => {
    const key = 'group:' + group.id;
    const roomMessage = activity.get(key)?.latest;
    const cards = new Map(
      activity.get('roster:' + group.id)?.cards?.map((card) => [card.id, card]),
    );
    const members = group.joinedIds
      .filter((id) => id !== uid)
      .map((id): MemberConversation => {
        const person = byPeer.get(id);
        const row = memberRow(group.id, id, person, cards.get(id));
        const contact = person?.requestId
          ? { key: 'contact:' + person.id, target: { peerId: id, requestId: person.requestId } }
          : undefined;
        const direct = contact && recent.get(contact.target.requestId);
        const privateMessage = activity.get(row.key)?.latest;
        const directUnread = contact ? (counts.get(threadKey(contact.target)) ?? 0) : 0;
        const memberUnread = counts.get(row.key) ?? 0;
        const recentDirect = !!direct && (!privateMessage || direct.time > privateMessage.time);
        const openContact =
          directUnread && !memberUnread
            ? true
            : memberUnread && !directUnread
              ? false
              : recentDirect;
        const preview = recentDirect ? direct : privateMessage;
        return {
          ...row,
          contact,
          openContact,
          preview,
          activityTime: preview?.time,
          unread: directUnread + memberUnread,
        };
      })
      .sort(byActivity);
    return {
      key,
      name: group.name,
      target: { groupId: group.id },
      members,
      unread: counts.get(key) ?? 0,
      preview: roomMessage,
      activityTime: Math.max(roomMessage?.time ?? 0, members[0]?.activityTime ?? 0),
    };
  });
  return [...people, ...rooms].sort(byActivity);
}

export interface ChatSelection {
  key: string;
  groupId?: string;
}

function isMember(row: Conversation): row is MemberConversation {
  return 'memberId' in row.target;
}
export function selectConversation(row: Conversation): ChatSelection {
  return {
    key: isMember(row) && row.openContact && row.contact ? row.contact.key : row.key,
    groupId: 'groupId' in row.target ? row.target.groupId : undefined,
  };
}

/** Keep the open transcript stable while live updates change its row's position. */
export function resolveConversation(rows: readonly Conversation[], choice?: ChatSelection) {
  if (!choice) return;
  const top = rows.find((row) => row.key === choice.key);
  if (top)
    return {
      row: top,
      target: top.target,
      groupId: 'groupId' in top.target ? top.target.groupId : undefined,
    };
  // A contact link can point into more than one shared group. Prefer the group the user opened.
  const findMember = (room: Conversation) =>
    room.members?.find((m) => m.key === choice.key || m.contact?.key === choice.key);
  const preferred = rows.find(
    (row) => 'groupId' in row.target && row.target.groupId === choice.groupId,
  );
  let member = preferred && findMember(preferred);
  if (!member) {
    for (const room of rows) {
      if (room === preferred) continue;
      member = findMember(room);
      if (member) break;
    }
  }
  if (member)
    return {
      row: member,
      groupId: member.target.groupId,
      target: member.contact?.key === choice.key ? member.contact.target : member.target,
    };
}

export function visibleConversations(
  rows: readonly Conversation[],
  expandedGroupId: string | undefined,
  term: string,
  collapsedGroupId?: string,
) {
  return rows.flatMap((row) => {
    const matches = row.name.toLocaleLowerCase().includes(term);
    if (!row.members) return matches ? [row] : [];
    const expanded = 'groupId' in row.target && row.target.groupId === expandedGroupId;
    const children =
      expanded && matches
        ? row.members
        : term
          ? row.members.filter((m) => m.name.toLocaleLowerCase().includes(term))
          : [];
    const collapsed = 'groupId' in row.target && row.target.groupId === collapsedGroupId;
    return matches || children.length ? [row, ...(collapsed ? [] : children)] : [];
  });
}
