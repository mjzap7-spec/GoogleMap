import type { ReadTime } from '../models/chat';
import {
  emptyThread,
  newerTime,
  type LocalChatHistory,
  type LocalHistory,
  type LocalThreadHistory,
} from '../models/localChatHistory';

interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
type Watch = { next: (history: LocalHistory) => void; fail: () => void };
type Account = {
  value?: LocalHistory;
  loading?: Promise<void>;
  queue: Promise<void>;
  watches: Set<Watch>;
};

/** Serializes changes per account and publishes only after durable local storage succeeds. */
export class StoredChatHistory implements LocalChatHistory {
  private accounts = new Map<string, Account>();
  constructor(private storage: Storage) {}
  private key(uid: string) {
    return 'chat-history:v1:' + encodeURIComponent(uid);
  }
  private account(uid: string) {
    let account = this.accounts.get(uid);
    if (!account) {
      account = { queue: Promise.resolve(), watches: new Set() };
      this.accounts.set(uid, account);
    }
    return account;
  }
  private load(uid: string, account: Account) {
    if (account.value) return Promise.resolve();
    if (!account.loading) {
      account.loading = this.storage
        .getItem(this.key(uid))
        .then((raw) => {
          const entries: [string, LocalThreadHistory][] = raw ? JSON.parse(raw) : [];
          if (
            !Array.isArray(entries) ||
            entries.some(
              ([key, value]) =>
                typeof key !== 'string' ||
                !value ||
                !Array.isArray(value.hiddenIds) ||
                value.hiddenIds.some((id) => typeof id !== 'string') ||
                (value.clearedThrough &&
                  (!Number.isInteger(value.clearedThrough.seconds) ||
                    !Number.isInteger(value.clearedThrough.nanoseconds))),
            )
          )
            throw Error('Invalid local history');
          account.value = Object.fromEntries(entries);
        })
        .finally(() => {
          account.loading = undefined;
        });
    }
    return account.loading;
  }
  observe(uid: string, next: Watch['next'], fail: Watch['fail']) {
    const account = this.account(uid);
    const watch = { next, fail };
    account.watches.add(watch);
    void this.load(uid, account)
      .then(() => {
        if (account.watches.has(watch)) next(account.value!);
      })
      .catch(() => {
        if (account.watches.has(watch)) fail();
      });
    return () => {
      account.watches.delete(watch);
    };
  }
  private change(uid: string, thread: string, ids: readonly string[], through?: ReadTime) {
    const account = this.account(uid);
    const save = account.queue.then(async () => {
      await this.load(uid, account);
      const previous = account.value![thread] ?? emptyThread;
      const value = {
        ...account.value,
        [thread]: {
          hiddenIds: [...new Set([...previous.hiddenIds, ...ids])],
          clearedThrough: newerTime(previous.clearedThrough, through),
        },
      };
      await this.storage.setItem(this.key(uid), JSON.stringify(Object.entries(value)));
      account.value = value;
      for (const watch of account.watches) watch.next(value);
    });
    account.queue = save.catch(() => {});
    return save;
  }
  hide(uid: string, thread: string, ids: readonly string[]) {
    return this.change(uid, thread, ids);
  }
  clear(uid: string, thread: string, through: ReadTime | undefined, ids: readonly string[]) {
    return this.change(uid, thread, ids, through);
  }
}
