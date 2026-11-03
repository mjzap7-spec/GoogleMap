import { AuthFailure, type AuthFailureCode } from '../../models/AuthFailure';
const codes: Record<string, AuthFailureCode> = {
  'auth/requires-recent-login': 'recent-login',
  'auth/popup-closed-by-user': 'auth-cancelled',
  'auth/cancelled-popup-request': 'auth-cancelled',
  'auth/popup-blocked': 'popup-blocked',
  'auth/account-exists-with-different-credential': 'account-conflict',
  'auth/unauthorized-domain': 'auth-configuration',
  SIGN_IN_CANCELLED: 'auth-cancelled',
  IN_PROGRESS: 'rate-limited',
  PLAY_SERVICES_NOT_AVAILABLE: 'google-not-configured',
  '10': 'google-not-configured',
  '12501': 'auth-cancelled',
  '12502': 'rate-limited',
  'auth/invalid-credential': 'invalid-credentials',
  'auth/user-not-found': 'invalid-credentials',
  'auth/wrong-password': 'invalid-credentials',
  'auth/email-already-in-use': 'email-in-use',
  'auth/invalid-email': 'invalid-email',
  'auth/weak-password': 'weak-password',
  'auth/too-many-requests': 'rate-limited',
  'auth/network-request-failed': 'offline',
  'auth/operation-not-allowed': 'provider-disabled',
  'auth/quota-exceeded': 'email-quota',
  'auth/invalid-message-payload': 'email-configuration',
  'auth/invalid-sender': 'email-configuration',
  'auth/invalid-recipient-email': 'invalid-email',
  'auth/invalid-api-key': 'auth-configuration',
  'auth/app-not-authorized': 'auth-configuration',
  'auth/configuration-not-found': 'auth-configuration',
  'permission-denied': 'profile-permission',
  unavailable: 'offline',
};
export function firebaseCodeOf(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : '';
}
export function translateFirebaseError(error: unknown): AuthFailure {
  return error instanceof AuthFailure
    ? error
    : new AuthFailure(codes[firebaseCodeOf(error)] ?? 'unknown');
}
