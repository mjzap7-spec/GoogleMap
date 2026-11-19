import { getFirebaseAuth } from '../../../../config/firebase/client';
import { pickChatFile, saveChatFile } from '../../../../shared/platform/chatFiles';
import {
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type ChatFiles,
  type PickedAttachment,
} from '../../models/attachments';
import type { ChatPeer } from '../../models/chat';

export class PrivateChatFiles implements ChatFiles {
  pick = pickChatFile;
  private async request(path: string, options: RequestInit = {}) {
    const endpoint = process.env.EXPO_PUBLIC_CHAT_FILES_ENDPOINT;
    if (!endpoint) throw Error('File sharing setup is required.');
    const url = new URL(endpoint.replace(/\/$/, '') + path);
    if (url.protocol !== 'https:' || url.username || url.password)
      throw Error('File sharing setup is required.');
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    if (!token) throw Error('Please sign in again.');
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 30000);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        ...options,
        signal: abort.signal,
        redirect: 'error',
        headers: { ...options.headers, Authorization: 'Bearer ' + token },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      if (response.status === 404) throw Error('This file has expired or was removed.');
      if (response.status === 403) throw Error('You no longer have access to this file.');
      throw Error('Could not transfer the file. Please try again.');
    }
    return response;
  }
  async upload(peer: ChatPeer, file: PickedAttachment): Promise<Attachment> {
    if (!file.bytes.length || file.bytes.length > MAX_ATTACHMENT_BYTES)
      throw Error('Choose a file smaller than 1 MB.');
    const body = new Uint8Array(file.bytes);
    const response = await this.request('/files', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chat-Context': JSON.stringify(peer),
      },
    });
    const { id } = await response.json();
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
      throw Error('Could not transfer the file. Please try again.');
    return {
      id,
      name: file.name.slice(0, 180),
      size: file.bytes.length,
      mime: file.mime.slice(0, 120),
    };
  }
  async download(file: Attachment) {
    const response = await this.request('/files/' + file.id);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== file.size || bytes.length > MAX_ATTACHMENT_BYTES)
      throw Error('Could not transfer the file. Please try again.');
    await saveChatFile(file.name, file.mime, bytes);
  }
  async discard(id: string) {
    await this.request('/files/' + id, { method: 'DELETE' });
  }
}
