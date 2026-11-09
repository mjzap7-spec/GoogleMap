import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import type { PrivateGroup } from '../../contacts/models/sharing';
import type { ChatPeer, ChatRepository } from '../models/chat';
import { memberKey, type GroupActivity } from '../models/conversations';

type Watch = { stop?: () => void };
type Subscribe = (next: (value: GroupActivity) => void, fail: () => void) => () => void;

/** Watch just the last message of each accessible thread while Chats is open. */
export class GroupChatActivityViewModel extends ObservableViewModel<{
  entries: ReadonlyMap<string, GroupActivity>;
}> {
  private watches = new Map<string, Watch>();

  constructor(
    private repo: ChatRepository | undefined,
    private uid: string,
  ) {
    super({ entries: new Map() });
  }

  sync = (groups: readonly PrivateGroup[], retry = false) => {
    const repo = this.repo;
    if (!repo) return;
    const active = new Set<string>();
    const watch = (key: string, subscribe: Subscribe) => {
      active.add(key);
      const existing = this.watches.get(key);
      if (existing && !(retry && this.state.entries.get(key)?.failed)) return;
      const current: Watch = {};
      this.watches.set(key, current);
      existing?.stop?.();
      const next = (value: GroupActivity) => {
        if (this.watches.get(key) !== current) return;
        const previous = this.state.entries.get(key);
        // Record the first (even empty) result so entry routing knows it has loaded.
        // Repeated empty snapshots and metadata acknowledgements need no list update.
        if (
          previous &&
          !value.cards &&
          !previous?.cards &&
          value.failed === previous?.failed &&
          value.latest?.id === previous?.latest?.id &&
          value.latest?.time === previous?.latest?.time &&
          value.latest?.text === previous?.latest?.text
        )
          return;
        this.update({ entries: new Map(this.state.entries).set(key, value) });
      };
      const fail = () => next({ failed: true });
      try {
        current.stop = subscribe(next, fail);
      } catch {
        fail();
      }
    };
    const watchLatest = (key: string, peer: ChatPeer) =>
      watch(key, (next, fail) =>
        repo.messages(this.uid, peer, 1, ([latest]) => next({ latest }), fail),
      );
    for (const group of groups) {
      if (!group.joinedIds.includes(this.uid)) continue;
      watch('roster:' + group.id, (next, fail) =>
        repo.members(this.uid, group.id, (cards) => next({ cards }), fail),
      );
      watchLatest('group:' + group.id, { groupId: group.id, senderName: '' });
      for (const id of group.joinedIds) {
        if (id !== this.uid)
          watchLatest(memberKey(group.id, id), { groupId: group.id, memberId: id });
      }
    }
    const entries = new Map(this.state.entries);
    for (const [key, current] of this.watches) {
      if (active.has(key)) continue;
      this.watches.delete(key);
      current.stop?.();
      entries.delete(key);
    }
    if (entries.size !== this.state.entries.size) this.update({ entries });
  };

  stop = () => this.sync([]);
}
