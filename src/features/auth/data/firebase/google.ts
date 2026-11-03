import { GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';

/** Web implementation; Metro selects google.native.ts for Android/iOS. */
export function authenticateGoogle(auth: Auth) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}
