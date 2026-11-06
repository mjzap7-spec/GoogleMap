import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import type { ChatMessage, ChatPeer, ChatPreview, ChatRepository } from '../models/chat';
import { MAX_MESSAGE_LENGTH } from '../models/messageDraft';
interface ChatState {
  messages: ChatMessage[];
  previews: ChatPreview[];
  loading: boolean;
  sending: boolean;
  more: boolean;
  draft: string;
  error: string;
}
export class ChatViewModel extends ObservableViewModel<ChatState> {
  private unsubscribe?: () => void;
  private version = 0;
  private count = 50;
  constructor(
    private repo: ChatRepository | undefined,
    private uid: string,
    private peer?: ChatPeer,
  ) {
    super({
      messages: [],
      previews: [],
      loading: true,
      sending: false,
      more: false,
      draft: '',
      error: '',
    });
  }
  start = () => {
    this.stop();
    const version = this.version;
    const fail = () => {
      if (version === this.version)
        this.update({
          messages: [],
          previews: [],
          more: false,
          loading: false,
          error: 'Could not load chats. Please retry.',
        });
    };
    this.update({ loading: true, error: '' });
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
              if (version === this.version)
                this.update({
                  messages: rows.slice(0, this.count),
                  more: rows.length > this.count,
                  loading: false,
                  error: '',
                });
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
  };
  older = () => {
    if (this.state.loading || !this.state.more) return;
    this.count += 50;
    this.start();
  };
  stop = () => {
    this.version++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  };
  setDraft = (draft: string) => this.update({ draft });
  send = async () => {
    const text = this.state.draft.trim();
    if (!this.repo || !this.peer || !text || text.length > MAX_MESSAGE_LENGTH || this.state.sending)
      return;
    this.update({ sending: true, error: '' });
    try {
      await this.repo.send(this.uid, this.peer, text);
      this.update({ draft: '' });
    } catch {
      this.update({ error: 'Message could not be sent. Try again.' });
    } finally {
      this.update({ sending: false });
    }
  };
}
