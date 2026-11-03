import type { AvatarSelection } from './auth';

export interface UploadedAvatar {
  readonly url: string;
  /** Temporary cleanup capability; never persist it in a profile or URL. */
  readonly cleanupToken?: string;
}
export interface AvatarStorage {
  upload(avatar: AvatarSelection): Promise<UploadedAvatar>;
  discard(upload: UploadedAvatar): Promise<void>;
}
