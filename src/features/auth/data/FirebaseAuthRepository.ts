import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../../../config/firebase/client';
import type { AuthRepository, AuthUser, UserProfile } from '../models/auth';
import { AuthFailure } from '../models/AuthFailure';
import { firebaseCodeOf, translateFirebaseError } from './firebase/errorMapping';
import { registerFirebaseUser } from './firebase/registration';
import { observeFirebaseSession } from './firebase/sessionObserver';
import { authenticateGoogle } from './firebase/google';
import { saveFirebaseProfile } from './firebase/profile';
import type { AvatarStorage } from '../models/avatarStorage';
import type { ProfileCache } from '../models/profileCache';

/** Adapter boundary: exposes domain values and failures, never Firebase SDK types. */
export class FirebaseAuthRepository implements AuthRepository {
  constructor(
    private avatarStorage: AvatarStorage,
    private profileCache?: ProfileCache,
  ) {}
  readonly isConfigured = isFirebaseConfigured;

  private auth() {
    if (!this.isConfigured) throw new AuthFailure('not-configured');
    return getFirebaseAuth();
  }

  observeSession(onChange: (user: AuthUser | null) => void, onError: (error: unknown) => void) {
    try {
      return observeFirebaseSession(this.auth(), onChange, onError, this.profileCache);
    } catch (error) {
      onError(translateFirebaseError(error));
      return () => {};
    }
  }

  async signIn(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(this.auth(), email, password);
    } catch (error) {
      throw translateFirebaseError(error);
    }
  }

  async signUp(email: string, password: string) {
    await registerFirebaseUser(this.auth(), email, password);
  }

  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(this.auth(), email);
    } catch (error) {
      // Keep the result neutral even if email-enumeration protection is disabled.
      if (firebaseCodeOf(error) !== 'auth/user-not-found') throw translateFirebaseError(error);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      const auth = this.auth();
      const user = auth.currentUser;
      if (!user || user.uid !== userId || !user.email) throw new AuthFailure('session-changed');
      if (!user.providerData.some((provider) => provider.providerId === 'password'))
        throw new AuthFailure('google-password');
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword),
      );
      if (auth.currentUser !== user) throw new AuthFailure('session-changed');
      await updatePassword(user, newPassword);
    } catch (error) {
      throw translateFirebaseError(error);
    }
  }

  async signInWithGoogle() {
    try {
      await authenticateGoogle(this.auth());
    } catch (error) {
      throw translateFirebaseError(error);
    }
  }

  async signUpWithGoogle() {
    await registerFirebaseUser(this.auth(), '', '', true);
  }

  async saveProfile(profile: UserProfile, avatarUrl: string | null) {
    try {
      return await saveFirebaseProfile(this.auth(), profile, avatarUrl, this.avatarStorage);
    } catch (error) {
      throw translateFirebaseError(error);
    }
  }

  async signOut() {
    try {
      await signOut(this.auth());
    } catch (error) {
      throw translateFirebaseError(error);
    }
  }
}
