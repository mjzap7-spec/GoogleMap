import { compareTime, type ChatMessage, type ReadTime } from './chat';

export type MessageStatus = 'sending' | 'sent' | 'read';

/** Never turn a local write or an estimated timestamp into a read acknowledgement. */
export function messageStatus(message: ChatMessage, readThrough?: ReadTime): MessageStatus {
  if (message.pending) return 'sending';
  return message.createdAt && readThrough && compareTime(readThrough, message.createdAt) >= 0
    ? 'read'
    : 'sent';
}
