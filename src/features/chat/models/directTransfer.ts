import type { ChatPeer } from './chat';
import type { CallCandidate, CallDescription } from '../../interviews/models/interview';

export const DIRECT_FILE_PREFIX = '[[direct-file:v1]]';
export const MAX_DIRECT_FILE_BYTES = 100 * 1024 * 1024;
export type TransferStatus =
  'offered' | 'accepted' | 'completed' | 'cancelled' | 'declined' | 'failed';
export interface TransferInfo {
  name: string;
  size: number;
  mime: string;
}
export interface DirectTransfer extends TransferInfo {
  id: string;
  fromId: string;
  toId: string;
  status: TransferStatus;
  expiresAt: number;
  offer: CallDescription;
  answer?: CallDescription;
}
export interface TransferSource extends TransferInfo {
  read(offset: number, length: number): Promise<Uint8Array>;
  close(): void;
}
export interface TransferSink {
  write(bytes: Uint8Array): Promise<void>;
  save(): Promise<void>;
  close(): void;
}
export interface DirectFileDevice {
  pick(): Promise<TransferSource | undefined>;
  receive(info: TransferInfo): Promise<TransferSink>;
}
export interface TransferRepository {
  create(
    uid: string,
    peer: ChatPeer,
    info: TransferInfo,
    offer: CallDescription,
  ): Promise<DirectTransfer>;
  watch(
    uid: string,
    id: string,
    next: (transfer: DirectTransfer | undefined) => void,
    fail: () => void,
  ): () => void;
  accept(uid: string, id: string, answer: CallDescription): Promise<void>;
  finish(
    uid: string,
    id: string,
    status: 'completed' | 'cancelled' | 'declined' | 'failed',
  ): Promise<void>;
  candidate(uid: string, id: string, index: number, candidate: CallCandidate): Promise<void>;
  candidates(
    uid: string,
    id: string,
    peerId: string,
    next: (candidate: CallCandidate) => void,
    fail: () => void,
  ): () => void;
}
export interface DataTransferSession {
  offer(): Promise<CallDescription>;
  answer(offer: CallDescription): Promise<CallDescription>;
  applyAnswer(answer: CallDescription): Promise<void>;
  candidate(candidate: CallCandidate): Promise<void>;
  close(): void;
}
export interface DataTransferTransport {
  open(options: {
    size: number;
    source?: TransferSource;
    sink?: TransferSink;
    signal: AbortSignal;
    candidate: (candidate: CallCandidate) => void;
    progress: (bytes: number) => void;
    complete: () => void;
    fail: (message: string) => void;
  }): DataTransferSession;
}
export function directTransferId(text: string) {
  if (!text.startsWith(DIRECT_FILE_PREFIX)) return;
  const id = text.slice(DIRECT_FILE_PREFIX.length);
  return /^[a-zA-Z0-9]{20}$/.test(id) ? id : undefined;
}
