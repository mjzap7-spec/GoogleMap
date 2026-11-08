import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import {
  compareTime,
  threadKey,
  type ReadTime,
  type ChatMessage,
  type ChatPeer,
  type ChatPreview,
  type ChatRepository,
} from '../models/chat';
import { MAX_MESSAGE_LENGTH } from '../models/messageDraft';
import { historyFilter, newerTime, type LocalChatHistory } from '../models/localChatHistory';
export interface ClearChatTarget {
  through?: ReadTime;
  ids: string[];
}
interface ChatState {
  messages: ChatMessage[];
  previews: ChatPreview[];
  loading: boolean;
  sending: boolean;
  more: boolean;
  draft: string;
  error: string;
  readThrough?: ReadTime;
  receiptError: string;
  actionError: string;
  replying?: ChatMessage;
  editing?: ChatMessage;
  deletingId?: string;
  selecting: boolean;
  selectedIds: string[];
  localBusy: boolean;
  selectingAll: boolean;
  allSelected: boolean;
}
export class ChatViewModel extends ObservableViewModel<ChatState> {
  private unsubscribe?: () => void;
  private stopReads?: () => void;
  private active = false;
  private visibleThrough?: ReadTime;
  private publishedThrough?: ReadTime;
  private publishingRead = false;
  private readWatchFailed = false;
  private readWriteFailed = false;
  private version = 0;
  private count = 50;
  private draftBeforeEdit = '';
  private stopSelectAll?: () => void;
  constructor(
    private repo: ChatRepository | undefined,
    private uid: string,
    private peer?: ChatPeer,
    private history?: LocalChatHistory,
  ) {
    super({
      messages: [],
      previews: [],
      loading: true,
      sending: false,
      more: false,
      draft: '',
      error: '',
      receiptError: '',
      actionError: '',
      selecting: false,
      selectedIds: [],
      localBusy: false,
      selectingAll: false,
      allSelected: false,
    });
  }
  start = () => {
    this.stop();
    this.active = true;
    this.readWatchFailed = false;
    this.readWriteFailed = false;
    const version = this.version;
    const fail = () => {
      if (version === this.version) {
        this.stopSelectAll?.();
        this.update({
          messages: [],
          previews: [],
          more: false,
          loading: false,
          selectedIds: [],
          selecting: false,
          selectingAll: false,
          allSelected: false,
          error: 'Could not load chats. Please retry.',
        });
      }
    };
    this.update({ loading: true, error: '', receiptError: '' });
    if (!this.repo) {
      fail();
      return;
    }
    try {
      this.unsubscribe = this.peer
        ? this.repo.messages(
            this.uid,
            this.peer,
            this.count + 1,
            (rows) => {
              if (version === this.version) {
                const visibleIds = new Set(rows.map((message) => message.id));
                const previous = new Map(
                  this.state.messages.map((message) => [message.id, message]),
                );
                const oldest = rows.at(-1)?.time ?? 0;
                const selectedIds = this.state.selectedIds.filter(
                  (id) =>
                    visibleIds.has(id) ||
                    !previous.has(id) ||
                    (rows.length > this.count && previous.get(id)!.time <= oldest),
                );
                if (!selectedIds.length) this.stopSelectAll?.();
                this.update({
                  messages: rows.slice(0, this.count),
                  more: rows.length > this.count,
                  loading: false,
                  error: '',
                  selectedIds,
                  selecting: this.state.selecting && selectedIds.length > 0,
                  selectingAll: this.state.selectingAll && selectedIds.length > 0,
                  allSelected:
                    selectedIds.length > 0 &&
                    this.state.allSelected &&
                    rows.every((m) => selectedIds.includes(m.id)),
                  replying: this.state.replying
                    ? (rows.find((message) => message.id === this.state.replying?.id) ??
                      this.state.replying)
                    : undefined,
                });
              }
            },
            fail,
          )
        : this.repo.inbox(
            this.uid,
            (rows) => {
              if (version === this.version)
                this.update({ previews: rows, loading: false, error: '' });
            },
            fail,
          );
    } catch {
      fail();
    }
    if (this.peer) {
      const receiptFailed = () => {
        if (this.version === version) {
          this.readWatchFailed = true;
          this.updateReceiptError();
        }
      };
      try {
        this.stopReads = this.repo.readByOthers(
          this.uid,
          this.peer,
          (through) => {
            if (version !== this.version) return;
            if (this.readWatchFailed) {
              this.readWatchFailed = false;
              this.updateReceiptError();
            }
            if (!through) return;
            if (!this.state.readThrough || compareTime(through, this.state.readThrough) > 0)
              this.update({ readThrough: through });
          },
          receiptFailed,
        );
      } catch {
        receiptFailed();
      }
    }
  };
  older = () => {
    if (this.state.loading || !this.state.more) return;
    this.count += 50;
    this.start();
  };
  stop = () => {
    this.stopSelectAll?.();
    if (this.state.selectingAll) this.update({ selectingAll: false });
    this.version++;
    this.active = false;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.stopReads?.();
    this.stopReads = undefined;
    this.visibleThrough = undefined;
    this.publishedThrough = undefined;
    this.publishingRead = false;
  };
  markVisibleRead = (through: ReadTime) => {
    if (!this.active || !this.peer || !this.repo) return;
    if (!this.visibleThrough || compareTime(through, this.visibleThrough) > 0)
      this.visibleThrough = through;
    this.publishRead();
  };
  private publishRead() {
    const through = this.visibleThrough;
    if (
      !this.repo ||
      !this.peer ||
      !through ||
      this.publishingRead ||
      (this.publishedThrough && compareTime(this.publishedThrough, through) >= 0)
    )
      return;
    this.publishingRead = true;
    const version = this.version;
    void this.repo
      .shareRead(this.uid, this.peer, through)
      .then(() => {
        if (version !== this.version) return;
        this.publishingRead = false;
        this.publishedThrough = through;
        if (this.readWriteFailed) {
          this.readWriteFailed = false;
          this.updateReceiptError();
        }
        this.publishRead();
      })
      .catch(() => {
        if (version !== this.version) return;
        this.publishingRead = false;
        this.readWriteFailed = true;
        this.updateReceiptError();
      });
  }
  private updateReceiptError() {
    this.update({
      receiptError:
        this.readWatchFailed || this.readWriteFailed ? 'Read status unavailable. Retry.' : '',
    });
  }
  setDraft = (draft: string) => {
    if (!this.state.sending) this.update({ draft });
  };
  beginSelection = (messageId = this.state.messages[0]?.id) => {
    if (this.state.sending || this.state.localBusy || this.state.deletingId) return;
    if (!messageId || !this.state.messages.some((m) => m.id === messageId)) return;
    this.stopSelectAll?.();
    this.cancelAction();
    this.update({
      selecting: true,
      selectingAll: false,
      allSelected: false,
      selectedIds: [messageId],
    });
  };
  toggleSelection = (id: string) => {
    if (
      !this.state.selecting ||
      this.state.localBusy ||
      this.state.deletingId ||
      !this.state.messages.some((m) => m.id === id)
    )
      return;
    // A manual choice supersedes an in-flight Select all result.
    this.stopSelectAll?.();
    const selectedIds = this.state.selectedIds.includes(id)
      ? this.state.selectedIds.filter((value) => value !== id)
      : [...this.state.selectedIds, id];
    this.update({
      selecting: selectedIds.length > 0,
      selectingAll: false,
      allSelected: false,
      selectedIds,
    });
  };
  selectAll = () => {
    if (
      !this.state.selecting ||
      this.state.localBusy ||
      this.state.deletingId ||
      this.state.sending
    )
      return;
    // The header checkbox toggles both ways, including while its request is loading.
    if (this.state.allSelected || this.state.selectingAll) {
      this.stopSelectAll?.();
      this.update({
        selectedIds: [],
        selecting: false,
        allSelected: false,
        selectingAll: false,
        actionError: '',
      });
      return;
    }
    if (!this.peer || !this.repo) return;
    // Even a short cached page may be incomplete: require a complete server result.
    this.update({ selectingAll: true, actionError: '' });
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const stop = () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe?.();
      if (this.stopSelectAll === stop) this.stopSelectAll = undefined;
    };
    const fail = () => {
      if (cancelled) return;
      stop();
      this.update({
        selectingAll: false,
        actionError: 'Could not select all messages. Try again.',
      });
    };
    const timer = setTimeout(fail, 15000);
    this.stopSelectAll = stop;
    try {
      unsubscribe = this.repo.messageIds(
        this.uid,
        this.peer,
        (ids) => {
          if (cancelled) return;
          stop();
          const selectedIds = [...new Set(ids)];
          this.update({
            selectedIds,
            selecting: selectedIds.length > 0,
            selectingAll: false,
            allSelected: selectedIds.length > 0,
          });
        },
        fail,
      );
      if (cancelled) unsubscribe();
    } catch {
      fail();
    }
  };
  cancelSelection = () => {
    if (this.state.localBusy || this.state.deletingId) return;
    this.stopSelectAll?.();
    this.update({ selecting: false, selectingAll: false, allSelected: false, selectedIds: [] });
  };
  prepareClear = (): ClearChatTarget => ({
    through: this.state.messages.reduce<ReadTime | undefined>(
      (time, message) => newerTime(time, message.createdAt),
      undefined,
    ),
    ids: this.state.messages.map((message) => message.id),
  });
  deleteLocal = (ids: readonly string[]) => this.changeLocal({ ids: [...ids] }, false);
  clearLocal = (target: ClearChatTarget) => this.changeLocal(target, true);
  private async changeLocal(target: ClearChatTarget, clear: boolean) {
    if (
      !this.peer ||
      !this.history ||
      this.state.localBusy ||
      this.state.selectingAll ||
      this.state.sending ||
      this.state.deletingId
    )
      return false;
    this.update({ localBusy: true, actionError: '' });
    try {
      if (clear)
        await this.history.clear(this.uid, threadKey(this.peer), target.through, target.ids);
      else await this.history.hide(this.uid, threadKey(this.peer), target.ids);
      const hidden = historyFilter({
        hiddenIds: target.ids,
        clearedThrough: clear ? target.through : undefined,
      });
      if (
        (this.state.editing && hidden(this.state.editing)) ||
        (this.state.replying && hidden(this.state.replying))
      )
        this.cancelAction();
      this.update({
        messages: this.state.messages.filter((message) => !hidden(message)),
        selecting: false,
        selectedIds: [],
        allSelected: false,
      });
      return true;
    } catch {
      this.update({ actionError: 'Could not save changes on this device. Try again.' });
      return false;
    } finally {
      this.update({ localBusy: false });
    }
  }
  reply = (messageId: string) => {
    const message = this.state.messages.find((item) => item.id === messageId);
    if (
      !message ||
      message.pending ||
      this.state.sending ||
      this.state.selectingAll ||
      this.state.deletingId ||
      this.state.localBusy
    )
      return;
    this.cancelAction();
    this.cancelSelection();
    this.update({ replying: message, actionError: '' });
  };
  edit = (messageId: string) => {
    const message = this.state.messages.find((item) => item.id === messageId);
    if (
      !message ||
      message.fromId !== this.uid ||
      message.pending ||
      this.state.sending ||
      this.state.selectingAll ||
      this.state.localBusy ||
      this.state.deletingId
    )
      return;
    if (this.state.editing?.id === messageId) return;
    this.cancelSelection();
    if (!this.state.editing) this.draftBeforeEdit = this.state.draft;
    this.update({ editing: message, replying: undefined, draft: message.text, actionError: '' });
  };
  cancelAction = () => {
    if (this.state.sending) return;
    this.update({
      draft: this.state.editing ? this.draftBeforeEdit : this.state.draft,
      editing: undefined,
      replying: undefined,
      actionError: '',
    });
  };
  remove = async (messageId: string) => {
    const message = this.state.messages.find((item) => item.id === messageId);
    if (
      !this.repo ||
      !this.peer ||
      !message ||
      message.fromId !== this.uid ||
      message.pending ||
      this.state.sending ||
      this.state.localBusy ||
      this.state.deletingId
    )
      return false;
    this.update({ deletingId: messageId, actionError: '' });
    try {
      await this.repo.remove(this.uid, this.peer, messageId);
      if (this.state.editing?.id === messageId || this.state.replying?.id === messageId)
        this.cancelAction();
      return true;
    } catch {
      this.update({ actionError: 'Message could not be deleted. Try again.' });
      return false;
    } finally {
      this.update({ deletingId: undefined });
    }
  };
  send = async () => {
    const text = this.state.draft.trim();
    if (
      !this.repo ||
      !this.peer ||
      !text ||
      text.length > MAX_MESSAGE_LENGTH ||
      this.state.sending ||
      this.state.selecting ||
      this.state.localBusy ||
      this.state.deletingId
    )
      return;
    const editing = this.state.editing;
    if (editing && text === editing.text) {
      this.cancelAction();
      return;
    }
    this.update({ sending: true, actionError: '' });
    try {
      if (editing) await this.repo.edit(this.uid, this.peer, editing.id, text);
      else await this.repo.send(this.uid, this.peer, text, this.state.replying?.id);
      this.update({
        draft: editing ? this.draftBeforeEdit : '',
        editing: undefined,
        replying: undefined,
      });
    } catch {
      this.update({
        actionError: editing
          ? 'Message could not be edited. Try again.'
          : 'Message could not be sent. Try again.',
      });
    } finally {
      this.update({ sending: false });
    }
  };
}
