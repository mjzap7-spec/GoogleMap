export type AuthFailureCode =
  | 'session-changed'
  | 'google-password'
  | 'recent-login'
  | 'invalid-credentials'
  | 'email-in-use'
  | 'invalid-email'
  | 'weak-password'
  | 'rate-limited'
  | 'offline'
  | 'provider-disabled'
  | 'email-quota'
  | 'email-configuration'
  | 'auth-configuration'
  | 'google-not-configured'
  | 'google-native-unavailable'
  | 'auth-cancelled'
  | 'popup-blocked'
  | 'account-conflict'
  | 'not-configured'
  | 'profile-permission'
  | 'cloudinary-not-configured'
  | 'avatar-upload'
  | 'avatar-upload-timeout'
  | 'profile-unavailable'
  | 'registration-cleanup'
  | 'avatar-invalid'
  | 'avatar-picker'
  | 'unknown';
const messages: Record<AuthFailureCode, string> = {
  'session-changed': 'Your session changed. Reopen Settings and try again.',
  'google-password': 'Your password is managed by Google.',
  'recent-login': 'Please sign in again before changing your password.',
  'cloudinary-not-configured':
    'Avatar uploads are not configured. Check the Cloudinary cloud name and unsigned upload preset in .env and the preset settings.',
  'avatar-upload':
    'Could not upload your photo. Check your connection and Cloudinary settings, then try again.',
  'avatar-upload-timeout': 'Photo upload took too long. Check your connection and try again.',
  'google-native-unavailable':
    'Open the installed Google Map app, not Expo Go, to use Google sign-in. If needed, rebuild with npx expo run:android.',
  'google-not-configured':
    'Google sign-in needs OAuth client IDs and a development build. Follow the Google setup in README.md.',
  'auth-cancelled': 'Google sign-in was cancelled. Please try again when ready.',
  'popup-blocked': 'Allow popups for this site, then try Google sign-in again.',
  'account-conflict':
    'This email uses a different sign-in method. Sign in using that method first.',
  'invalid-credentials': 'Email or password is incorrect.',
  'email-in-use': 'This email already has an account. Try signing in.',
  'invalid-email': 'Please enter a valid email address.',
  'weak-password': 'Please choose a stronger password.',
  'rate-limited': 'Too many attempts. Please wait and try again.',
  offline: 'Check your internet connection and try again.',
  'provider-disabled':
    'Enable this sign-in provider (Email/Password or Google) in Firebase Authentication.',
  'email-quota': 'The email sending limit has been reached. Please try again later.',
  'email-configuration':
    'Password reset email is unavailable. The project owner needs to check the Firebase email template and sender settings.',
  'auth-configuration':
    'Authentication is not configured correctly. The project owner needs to check the Firebase project and API key settings.',
  'not-configured': 'Follow README.md and add your Firebase project configuration to .env first.',
  unknown: 'Something went wrong. Please try again.',
  'profile-permission': 'Profile saving is not allowed. Check the Firestore security rules.',
  'profile-unavailable':
    'You are signed in, but your profile could not be loaded. Check your connection and Firestore setup.',
  'registration-cleanup':
    'Registration was interrupted and cleanup was incomplete. Try signing in; the Firebase project owner may need to remove the incomplete account or profile before retrying.',
  'avatar-invalid': 'Choose a JPG, PNG, or WebP avatar smaller than 5 MB.',
  'avatar-picker': 'Could not open your photo library. Check photo permissions and try again.',
};
export class AuthFailure extends Error {
  constructor(public readonly code: AuthFailureCode) {
    super(messages[code]);
    this.name = 'AuthFailure';
  }
}
export function authErrorMessage(error: unknown): string {
  return error instanceof AuthFailure ? error.message : messages.unknown;
}
