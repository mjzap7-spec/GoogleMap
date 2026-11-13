import type { ChatPeer } from '../../chat/models/chat';

export type InterviewMode = 'voice' | 'video';
export const callMessagePrefix = 'call_';
export const interviewInvitation: Record<InterviewMode, string> = {
  voice: 'Voice interview invitation',
  video: 'Video interview invitation',
};
export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended' | 'busy';
export interface CallHistory {
  status: CallStatus;
  answered: boolean;
  durationSeconds?: number;
}
export interface InterviewTarget {
  id: string;
  name: string;
  avatarUrl?: string | null;
  kind: 'contact' | 'group';
  contextId: string;
}
export interface CallDescription {
  type: 'offer' | 'answer';
  sdp: string;
}
export interface CallCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}
export interface InterviewCall {
  id: string;
  fromId: string;
  toId: string;
  fromName: string;
  fromAvatar: string | null;
  kind: 'contact' | 'group';
  contextId: string;
  mode: InterviewMode;
  status: CallStatus;
  expiresAt: number;
  validUntil: number;
  offer?: CallDescription;
  answer?: CallDescription;
}
export interface InterviewRepository {
  connected?(uid: string, id: string): Promise<void>;
  history?(uid: string, id: string, next: (history: CallHistory | undefined) => void): () => void;
  prepare?(uid: string): Promise<void>;
  incoming(uid: string, next: (calls: InterviewCall[]) => void, fail: () => void): () => void;
  create(
    uid: string,
    name: string,
    avatar: string | null,
    target: InterviewTarget,
    mode: InterviewMode,
    offer: CallDescription,
  ): Promise<InterviewCall>;
  watch(
    uid: string,
    id: string,
    next: (call: InterviewCall | undefined) => void,
    fail: () => void,
  ): () => void;
  accept(uid: string, id: string, answer: CallDescription): Promise<void>;
  finish(uid: string, id: string, status: 'ended' | 'declined' | 'busy'): Promise<void>;
  candidate(uid: string, id: string, index: number, candidate: CallCandidate): Promise<void>;
  candidates(
    uid: string,
    id: string,
    otherId: string,
    next: (candidate: CallCandidate) => void,
    fail: () => void,
  ): () => void;
}
export interface MediaPreview {
  url?: string;
  stream?: unknown;
}
export interface CallMediaEvents {
  candidate: (candidate: CallCandidate) => void;
  remote: (preview: MediaPreview) => void;
  connection: (state: 'connected' | 'disconnected' | 'failed') => void;
}
export interface CallMediaSession {
  local: MediaPreview;
  offer(): Promise<CallDescription>;
  answer(offer: CallDescription): Promise<CallDescription>;
  applyAnswer(answer: CallDescription): Promise<void>;
  addCandidate(candidate: CallCandidate): Promise<void>;
  mute(muted: boolean): void;
  camera(enabled: boolean): void;
  switchCamera(): void;
  close(): void;
}
export interface CallMedia {
  prepare?(): Promise<unknown>;
  open(mode: InterviewMode, events: CallMediaEvents): Promise<CallMediaSession>;
}
export function interviewTarget(
  peer: ChatPeer | undefined,
  name: string,
  avatarUrl?: string | null,
): InterviewTarget | undefined {
  if (!peer || 'senderName' in peer) return undefined;
  return 'memberId' in peer
    ? { id: peer.memberId, name, avatarUrl, kind: 'group', contextId: peer.groupId }
    : { id: peer.peerId, name, avatarUrl, kind: 'contact', contextId: peer.requestId };
}
export const terminalCall = (status: CallStatus) => !['ringing', 'accepted'].includes(status);
