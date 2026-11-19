import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import { ATTACHMENT_PREFIX, type Attachment, type ChatFiles } from '../models/attachments';
import type { ChatPeer, ChatRepository } from '../models/chat';

export class AttachmentsViewModel extends ObservableViewModel<{
  sending: boolean;
  downloading?: string;
  error: string;
}> {
  private generation = 0;
  constructor(
    private files: ChatFiles | undefined,
    private chat: ChatRepository | undefined,
    private uid: string,
    private peer: ChatPeer,
  ) {
    super({ sending: false, error: '' });
  }
  stop = () => {
    this.generation++;
    this.update({ sending: false, downloading: undefined });
  };
  send = async () => {
    if (this.state.sending || !this.files || !this.chat) return;
    const generation = this.generation;
    this.update({ sending: true, error: '' });
    let uploaded: Attachment | undefined;
    let messageStarted = false;
    try {
      const file = await this.files.pick();
      if (!file || generation !== this.generation) return;
      uploaded = await this.files.upload(this.peer, file);
      if (generation !== this.generation) {
        await this.files.discard(uploaded.id);
        return;
      }
      messageStarted = true;
      await this.chat.send(this.uid, this.peer, ATTACHMENT_PREFIX + JSON.stringify(uploaded));
    } catch (error) {
      // Once a message write starts, its server result can be uncertain. Keep its file until expiry.
      if (uploaded && !messageStarted) void this.files.discard(uploaded.id).catch(() => {});
      if (generation === this.generation)
        this.update({
          error:
            error instanceof Error
              ? error.message
              : 'Could not transfer the file. Please try again.',
        });
    } finally {
      if (generation === this.generation) this.update({ sending: false });
    }
  };
  download = async (file: Attachment) => {
    if (!this.files || this.state.downloading) return;
    const generation = this.generation;
    this.update({ downloading: file.id, error: '' });
    try {
      await this.files.download(file);
    } catch (error) {
      if (generation === this.generation)
        this.update({
          error:
            error instanceof Error
              ? error.message
              : 'Could not transfer the file. Please try again.',
        });
    } finally {
      if (generation === this.generation) this.update({ downloading: undefined });
    }
  };
}
