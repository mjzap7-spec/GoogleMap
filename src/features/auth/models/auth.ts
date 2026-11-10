export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
  readonly hasPassword?: boolean;
  readonly fullName?: string;
  readonly birthday?: string;
  readonly location?: string;
  readonly phoneNumber?: string;
  readonly avatarUrl?: string | null;
  readonly profileStatus?: 'loading' | 'ready' | 'error';
  /** Give the initial profile watch priority over background social listeners. */
  readonly profileSyncPending?: boolean;
}
export interface AvatarSelection {
  readonly uri: string;
  readonly base64: string;
  readonly contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}
export interface UserProfile {
  readonly fullName: string;
  readonly birthday: string;
  readonly location: string;
  /** Omit to leave the stored number unchanged; an empty string clears it. */
  readonly phoneNumber?: string;
  readonly avatar: AvatarSelection | null;
}
export interface AvatarPicker {
  pick(): Promise<AvatarSelection | null>;
}
export type AuthMode = 'signin' | 'signup' | 'reset';
export interface AuthForm {
  readonly email: string;
  readonly password: string;
  readonly confirm: string;
}
/** Contract implemented by infrastructure. No Firebase types cross this boundary. */
export interface AuthRepository {
  readonly isConfigured: boolean;
  observeSession(
    onChange: (user: AuthUser | null) => void,
    onError: (error: unknown) => void,
  ): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signUpWithGoogle(): Promise<void>;
  saveProfile(profile: UserProfile, avatarUrl: string | null): Promise<string | null>;
  resetPassword(email: string): Promise<void>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
}
