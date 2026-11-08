import type { LocalThreadHistory } from './localChatHistory';

export interface ChatMessage {
  id: string;
  fromId: string;
  text: string;
  time: number;
  pending: boolean;
  createdAt?: ReadTime;
  senderName?: string;
  edited?: boolean;
  replyTo?: string;
  reply?: MessageReply;
}
/** Quotes contain live data from this conversation, never a copied message body. */
export interface MessageReply {
  id: string;
  fromId?: string;
  senderName?: string;
  text?: string;
  unavailable?: boolean;
}
export interface ChatPreview {
  messageId?: string;
  createdAt?: ReadTime;
  peerId: string;
  requestId: string;
  text: string;
  time: number;
}
export type ChatPeer =
  | { peerId: string; requestId: string }
  | { groupId: string; senderName: string }
  | { groupId: string; memberId: string };
// Preserve Firestore precision so a read receipt never rounds past a newer message.
export interface ReadTime {
  seconds: number;
  nanoseconds: number;
}
export function threadKey(peer: ChatPeer | { groupId: string }): string {
  if ('requestId' in peer) return 'direct:' + peer.requestId;
  if ('memberId' in peer) return 'member:' + JSON.stringify([peer.groupId, peer.memberId]);
  return 'group:' + peer.groupId;
}
export function compareTime(a: ReadTime, b: ReadTime) {
  return a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;
}
export interface MemberCard {
  id: string;
  name: string;
  avatarUrl: string | null;
}
export interface ChatRepository {
  /** IDs only for explicit Select all; does not hydrate message bodies or reply listeners. */
  messageIds(
    uid: string,
    peer: ChatPeer,
    next: (ids: string[]) => void,
    fail: () => void,
    history?: LocalThreadHistory,
  ): () => void;
  readByOthers(
    uid: string,
    peer: ChatPeer,
    next: (through: ReadTime | undefined) => void,
    fail: () => void,
  ): () => void;
  shareRead(uid: string, peer: ChatPeer, through: ReadTime): Promise<void>;
  receipts(uid: string, next: (rows: Map<string, ReadTime>) => void, fail: () => void): () => void;
  unread(
    uid: string,
    peer: ChatPeer,
    after: ReadTime | undefined,
    next: (count: number) => void,
    fail: () => void,
    history?: LocalThreadHistory,
  ): () => void;
  markRead(uid: string, peer: ChatPeer, through: ReadTime): Promise<void>;
  members(
    uid: string,
    groupId: string,
    next: (rows: MemberCard[]) => void,
    fail: () => void,
  ): () => void;
  inbox(uid: string, next: (rows: ChatPreview[]) => void, fail: () => void): () => void;
  messages(
    uid: string,
    peer: ChatPeer,
    count: number,
    next: (rows: ChatMessage[]) => void,
    fail: () => void,
    history?: LocalThreadHistory,
  ): () => void;
  send(uid: string, peer: ChatPeer, text: string, replyTo?: string): Promise<void>;
  edit(uid: string, peer: ChatPeer, messageId: string, text: string): Promise<void>;
  remove(uid: string, peer: ChatPeer, messageId: string): Promise<void>;
}
