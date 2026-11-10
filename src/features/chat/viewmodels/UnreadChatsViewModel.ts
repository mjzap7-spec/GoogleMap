import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import type { Contact } from '../../contacts/models/contact';
import type { PrivateGroup } from '../../contacts/models/sharing';
import { newerTime } from '../models/localChatHistory';
import {
  compareTime,
  threadKey,
  type ChatPeer,
  type ChatRepository,
  type ReadTime,
} from '../models/chat';

type Watch = { after?: ReadTime; stop?: () => void };

/** One badge subscription per distinct, accessible transcript, shared by every signed-in screen. */
export class UnreadChatsViewModel extends ObservableViewModel<{
  counts: ReadonlyMap<string, number>;
  total: number;
  failed: boolean;
}> {
  private peers = new Map<string, ChatPeer>();
  private watches = new Map<string, Watch>();
  private reads?: Map<string, ReadTime>;
  private localReads = new Map<string, ReadTime>();
  private rawCounts = new Map<string, number>();
  private viewers = new Map<symbol, string>();
  private pending = new Map<string, ReadTime>();
  private failedWrites = new Map<string, { peer: ChatPeer; through: ReadTime }>();
  private failures = new Set<string>();
  private stopReceipts?: () => void;
  private generation = 0;
  constructor(
    private repo: ChatRepository | undefined,
    private uid: string,
  ) {
    super({ counts: new Map(), total: 0, failed: false });
  }
  start = () => {
    this.resetSubscriptions();
    if (!this.repo) return;
    const generation = this.generation;
    const fail = () => {
      if (generation === this.generation) this.setFailure('receipts', true);
    };
    try {
      this.stopReceipts = this.repo.receipts(
        this.uid,
        (rows) => {
          if (generation !== this.generation) return;
          this.reads = rows;
          this.setFailure('receipts', false);
          this.reconcile();
        },
        fail,
      );
    } catch {
      fail();
    }
  };
  retry = () => {
    const writes = new Map(this.failedWrites);
    for (const [key, through] of this.pending) {
      const peer = this.peers.get(key);
      const failed = writes.get(key);
      if (peer && (!failed || compareTime(through, failed.through) > 0))
        writes.set(key, { peer, through });
    }
    this.start();
    for (const { peer, through } of writes.values())
      if (this.peers.has(threadKey(peer))) this.persistRead(peer, through);
  };
  /** Only a focused, foreground transcript registers here; opening the chat list does not. */
  view = (peer: ChatPeer) => {
    const key = threadKey(peer);
    const token = Symbol(key);
    this.viewers.set(token, key);
    this.publishCount(key);
    return () => {
      if (!this.viewers.delete(token)) return;
      this.publishCount(key);
    };
  };
  private setFailure(key: string, failed: boolean) {
    if (failed) this.failures.add(key);
    else this.failures.delete(key);
    this.update({ failed: this.failures.size > 0 });
  }
  sync = (contacts: readonly Contact[], groups: readonly PrivateGroup[]) => {
    const peers = new Map<string, ChatPeer>();
    const add = (peer: ChatPeer) => peers.set(threadKey(peer), peer);
    for (const contact of contacts)
      if (contact.peerId && contact.peerId !== this.uid && contact.requestId)
        add({ peerId: contact.peerId, requestId: contact.requestId });
    for (const group of groups) {
      if (!group.joinedIds.includes(this.uid)) continue;
      add({ groupId: group.id, senderName: '' });
      for (const memberId of group.joinedIds)
        if (memberId !== this.uid) add({ groupId: group.id, memberId });
    }
    this.peers = peers;
    this.reconcile();
  };
  private setCount(key: string, count: number) {
    if (count) this.rawCounts.set(key, count);
    else this.rawCounts.delete(key);
    this.publishCount(key);
  }
  private publishCount(key: string) {
    const viewing = [...this.viewers.values()].includes(key);
    const count = viewing ? 0 : (this.rawCounts.get(key) ?? 0);
    const previous = this.state.counts.get(key) ?? 0;
    if (count === previous) return;
    const counts = new Map(this.state.counts);
    if (count) counts.set(key, count);
    else counts.delete(key);
    this.update({ counts, total: this.state.total + count - previous });
  }
  private reconcile() {
    for (const [key, watch] of this.watches) {
      if (this.peers.has(key)) continue;
      this.watches.delete(key);
      watch.stop?.();
      this.setCount(key, 0);
      this.setFailure(key, false);
      this.failedWrites.delete(key);
      this.localReads.delete(key);
      this.setFailure('write:' + key, false);
    }
    if (!this.reads || !this.repo) return;
    for (const [key, peer] of this.peers) {
      const after = newerTime(this.reads.get(key), this.localReads.get(key));
      const previous = this.watches.get(key);
      if (
        previous &&
        (previous.after === after ||
          (previous.after && after && compareTime(previous.after, after) === 0))
      )
        continue;
      const watch: Watch = { after };
      this.watches.set(key, watch);
      previous?.stop?.();
      // A count from the old read position is invalid while the new query loads.
      this.setCount(key, 0);
      const fail = () => {
        if (this.watches.get(key) !== watch) return;
        this.setCount(key, 0);
        this.setFailure(key, true);
      };
      try {
        watch.stop = this.repo.unread(
          this.uid,
          peer,
          after,
          (count) => {
            if (this.watches.get(key) === watch) {
              this.setCount(key, count);
              this.setFailure(key, false);
            }
          },
          fail,
        );
      } catch {
        fail();
      }
    }
  }
  markRead = (peer: ChatPeer, through: ReadTime) => {
    const key = threadKey(peer);
    if (!this.repo) return;
    const pending = this.pending.get(key);
    const read = newerTime(this.reads?.get(key), this.localReads.get(key));
    if (
      (pending && compareTime(pending, through) >= 0) ||
      (read && compareTime(read, through) >= 0)
    )
      return;
    // Apply visibility locally before waiting for the server's receipt listener.
    // Retain this cursor on a write failure; Retry persists the same read intent.
    this.localReads.set(key, through);
    this.reconcile();
    this.persistRead(peer, through);
  };
  private persistRead(peer: ChatPeer, through: ReadTime) {
    if (!this.repo) return;
    const key = threadKey(peer);
    const generation = this.generation;
    this.pending.set(key, through);
    void this.repo
      .markRead(this.uid, peer, through)
      .then(() => {
        if (this.generation !== generation) return;
        const failed = this.failedWrites.get(key);
        if (failed && compareTime(failed.through, through) <= 0) {
          this.failedWrites.delete(key);
          this.setFailure('write:' + key, false);
        }
      })
      .catch(() => {
        const current = this.reads?.get(key);
        if (
          this.generation !== generation ||
          this.pending.get(key) !== through ||
          !this.peers.has(key)
        )
          return;
        if (!current || compareTime(current, through) < 0) {
          this.failedWrites.set(key, { peer, through });
          this.setFailure('write:' + key, true);
        }
      })
      .finally(() => {
        if (this.generation === generation && this.pending.get(key) === through)
          this.pending.delete(key);
      });
  }
  private resetSubscriptions() {
    this.generation++;
    this.stopReceipts?.();
    this.stopReceipts = undefined;
    this.reads = undefined;
    this.pending.clear();
    this.failedWrites.clear();
    this.failures.clear();
    this.rawCounts.clear();
    const watches = [...this.watches.values()];
    this.watches.clear();
    watches.forEach((w) => w.stop?.());
    this.update({ counts: new Map(), total: 0, failed: false });
  }
  stop = () => {
    this.viewers.clear();
    this.localReads.clear();
    this.resetSubscriptions();
  };
}
