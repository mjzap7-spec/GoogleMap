import type { ChatPeer } from './chat';

export const MAX_ATTACHMENT_BYTES = 1024 * 1024;
export const ATTACHMENT_PREFIX = '[[file:v1]]';
export interface Attachment {
  id: string;
  name: string;
  size: number;
  mime: string;
}
export interface PickedAttachment {
  name: string;
  mime: string;
  bytes: Uint8Array;
}
export interface ChatFiles {
  pick(): Promise<PickedAttachment | undefined>;
  upload(peer: ChatPeer, file: PickedAttachment): Promise<Attachment>;
  download(file: Attachment): Promise<void>;
  discard(id: string): Promise<void>;
}
export function parseAttachment(text: string): Attachment | undefined {
  if (!text.startsWith(ATTACHMENT_PREFIX)) return;
  try {
    const value = JSON.parse(text.slice(ATTACHMENT_PREFIX.length));
    if (
      /^[a-f0-9-]{36}$/.test(value.id) &&
      typeof value.name === 'string' &&
      value.name.length > 0 &&
      value.name.length <= 180 &&
      Number.isInteger(value.size) &&
      value.size > 0 &&
      value.size <= MAX_ATTACHMENT_BYTES &&
      typeof value.mime === 'string' &&
      value.mime.length <= 120
    )
      return { id: value.id, name: value.name, size: value.size, mime: value.mime };
  } catch {
    /* Old and malformed messages remain ordinary text. */
  }
}
