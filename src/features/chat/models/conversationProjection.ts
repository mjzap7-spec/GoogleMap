import { shallowEqual } from '../../../shared/mvvm/shallowEqual';
import { conversationList, type Conversation, type MemberConversation } from './conversations';

function sameRows<T>(previous: readonly T[], next: readonly T[]) {
  return previous.length === next.length && previous.every((row, index) => row === next[index]);
}

function sameOptionalObject<T extends object>(previous?: T, next?: T) {
  return previous === next || (!!previous && !!next && shallowEqual(previous, next));
}

function reconcile(previous: Conversation[], next: Conversation[]): Conversation[] {
  const byKey = new Map(previous.map((row) => [row.key, row]));
  const rows = next.map((row) => {
    const old = byKey.get(row.key);
    if (!old) return row;
    const members = row.members
      ? (reconcile(old.members ?? [], row.members) as MemberConversation[])
      : undefined;
    const member = row as MemberConversation;
    const oldMember = old as MemberConversation;
    const sameContact =
      member.contact === oldMember.contact ||
      (member.contact?.key === oldMember.contact?.key &&
        sameOptionalObject(member.contact?.target, oldMember.contact?.target));
    if (
      old.name === row.name &&
      old.avatarUrl === row.avatarUrl &&
      old.unread === row.unread &&
      old.activityTime === row.activityTime &&
      old.preview?.text === row.preview?.text &&
      old.preview?.time === row.preview?.time &&
      !!old.preview === !!row.preview &&
      shallowEqual(old.target, row.target) &&
      old.members === members &&
      sameContact &&
      member.openContact === oldMember.openContact
    )
      return old;
    return members ? { ...row, members } : row;
  });
  return sameRows(previous, rows) ? previous : rows;
}

/** Per-workspace projection: one updated chat does not redraw every visible row.
 * Retains only the current list, never messages from a previous account/workspace.
 */
export function createConversationProjection() {
  let previous: Conversation[] = [];
  let userId: string | undefined;
  return (...args: Parameters<typeof conversationList>) => {
    if (userId !== args[0]) {
      previous = [];
      userId = args[0];
    }
    previous = reconcile(previous, conversationList(...args));
    return previous;
  };
}
