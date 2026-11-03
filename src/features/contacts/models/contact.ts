import type { AuthUser } from '../../auth/models/auth';
import type { TravelPoint } from '../../map/models/travel';
export interface Contact {
  readonly id: string;
  readonly name: string;
  readonly peerId?: string;
  readonly requestId?: string;
  readonly fullName?: string;
  readonly email?: string;
  readonly birthday?: string;
  readonly profileLocation?: string;
  readonly avatarUrl?: string | null;
}
export interface ContactRequest {
  readonly id: string;
  readonly fromId: string;
  readonly fromName: string;
  readonly fromEmail: string;
}
export interface SharedMapUser {
  readonly id: string;
  readonly nickname: string;
  readonly avatarUrl: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly expiresAt: number;
}
export interface ContactFocus extends SharedMapUser {
  readonly revision: number;
}
export interface ContactEvent {
  readonly id: string;
  readonly name: string;
  readonly kind: 'accepted' | 'declined' | 'removed';
}
export interface ContactRepository {
  observeEvents?(
    userId: string,
    next: (events: ContactEvent[]) => void,
    error: (error: unknown) => void,
  ): () => void;
  dismissEvent?(userId: string, id: string): Promise<void>;
  observe(
    userId: string,
    next: (contacts: Contact[]) => void,
    error: (error: unknown) => void,
  ): () => void;
  /** Supports migration of the original private, name-only contact records. */
  add(userId: string, name: string): Promise<Contact>;
  registerSelf?(user: AuthUser): Promise<void>;
  observeRequests?(
    userId: string,
    next: (requests: ContactRequest[]) => void,
    error: (error: unknown) => void,
  ): () => void;
  sendRequest?(userId: string, email: string): Promise<void>;
  sendRequestToUser?(userId: string, peerId: string): Promise<void>;
  respond?(userId: string, request: ContactRequest, accept: boolean): Promise<void>;
  details?(userId: string, contact: Contact): Promise<Contact>;
  rename?(userId: string, contact: Contact, nickname: string): Promise<void>;
  remove?(userId: string, contact: Contact): Promise<void>;
  publishPresence?(userId: string, point: TravelPoint | null): Promise<void>;
  observeNearby?(
    userId: string,
    point: TravelPoint,
    next: (users: SharedMapUser[]) => void,
    error: (error: unknown) => void,
  ): () => void;
  sharedLocation?(userId: string, peerId: string): Promise<SharedMapUser | null>;
}
export class ContactFailure extends Error {}
export function contactErrorMessage(error: unknown) {
  return error instanceof ContactFailure
    ? error.message
    : 'Could not update contacts. Check your connection and try again.';
}
export function normalizeContactEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email))
    throw new ContactFailure('Enter a valid email address.');
  return email;
}
