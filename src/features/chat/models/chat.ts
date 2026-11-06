export interface ChatMessage {
  id: string;
  fromId: string;
  text: string;
  time: number;
  pending: boolean;
  createdAt?: ReadTime;
  senderName?: string;
}
export interface ChatPreview {
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
  receipts(uid: string, next: (rows: Map<string, ReadTime>) => void, fail: () => void): () => void;
  unread(
    uid: string,
    peer: ChatPeer,
    after: ReadTime | undefined,
    next: (count: number) => void,
    fail: () => void,
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
  ): () => void;
  send(uid: string, peer: ChatPeer, text: string): Promise<void>;
}
