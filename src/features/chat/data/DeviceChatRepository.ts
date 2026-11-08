import { threadKey, type ChatRepository, type ChatPeer, type ChatPreview } from '../models/chat';
import {
  emptyThread,
  historyFilter,
  type LocalChatHistory,
  type LocalHistory,
  type LocalThreadHistory,
} from '../models/localChatHistory';

/** Composes remote chats with device visibility; all write operations remain explicit. */
export class DeviceChatRepository implements ChatRepository {
  constructor(
    private remote: ChatRepository,
    private history: LocalChatHistory,
  ) {}
  private watch(
    uid: string,
    peer: ChatPeer,
    subscribe: (state: LocalThreadHistory, current: () => boolean) => () => void,
    fail: () => void,
  ) {
    let previous: LocalThreadHistory | undefined;
    let stop: (() => void) | undefined;
    let generation = 0;
    const stopHistory = this.history.observe(
      uid,
      (rows) => {
        const current = rows[threadKey(peer)] ?? emptyThread;
        if (current === previous) return;
        previous = current;
        const version = ++generation;
        stop?.();
        try {
          stop = subscribe(current, () => version === generation);
        } catch {
          fail();
        }
      },
      fail,
    );
    return () => {
      generation++;
      stopHistory();
      stop?.();
    };
  }
  messageIds: ChatRepository['messageIds'] = (uid, peer, next, fail) =>
    this.watch(
      uid,
      peer,
      (state, current) =>
        this.remote.messageIds(
          uid,
          peer,
          (ids) => {
            if (current()) next(ids);
          },
          () => {
            if (current()) fail();
          },
          state,
        ),
      fail,
    );
  messages: ChatRepository['messages'] = (uid, peer, count, next, fail) =>
    this.watch(
      uid,
      peer,
      (state, current) =>
        this.remote.messages(
          uid,
          peer,
          count,
          (rows) => {
            if (current()) next(rows);
          },
          () => {
            if (current()) fail();
          },
          state,
        ),
      fail,
    );
  unread: ChatRepository['unread'] = (uid, peer, after, next, fail) =>
    this.watch(
      uid,
      peer,
      (state, current) =>
        this.remote.unread(
          uid,
          peer,
          after,
          (count) => {
            if (current()) next(count);
          },
          () => {
            if (current()) fail();
          },
          state,
        ),
      fail,
    );
  inbox: ChatRepository['inbox'] = (uid, next, fail) => {
    let history: LocalHistory | undefined;
    let rows: ChatPreview[] | undefined;
    let stopped = false;
    let failed = false;
    const emit = () => {
      if (!stopped && !failed && history && rows)
        next(
          rows.filter(
            (row) =>
              !historyFilter(history![threadKey(row)])({
                id: row.messageId ?? '',
                createdAt: row.createdAt,
              }),
          ),
        );
    };
    const reportFailure = () => {
      if (!stopped) {
        failed = true;
        fail();
      }
    };
    const stopHistory = this.history.observe(
      uid,
      (value) => {
        history = value;
        emit();
      },
      reportFailure,
    );
    const stopRemote = this.remote.inbox(
      uid,
      (value) => {
        rows = value;
        emit();
      },
      reportFailure,
    );
    return () => {
      stopped = true;
      stopHistory();
      stopRemote();
    };
  };
  members: ChatRepository['members'] = (...args) => this.remote.members(...args);
  receipts: ChatRepository['receipts'] = (...args) => this.remote.receipts(...args);
  readByOthers: ChatRepository['readByOthers'] = (...args) => this.remote.readByOthers(...args);
  markRead: ChatRepository['markRead'] = (...args) => this.remote.markRead(...args);
  shareRead: ChatRepository['shareRead'] = (...args) => this.remote.shareRead(...args);
  send: ChatRepository['send'] = (...args) => this.remote.send(...args);
  edit: ChatRepository['edit'] = (...args) => this.remote.edit(...args);
  remove: ChatRepository['remove'] = (...args) => this.remote.remove(...args);
}
