import { createUserWithEmailAndPassword, type Auth } from 'firebase/auth';
import { translateFirebaseError } from './errorMapping';
import { authenticateGoogle } from './google';

/** Successful registration establishes the primary persisted session for profile setup. */
export async function registerFirebaseUser(
  auth: Auth,
  email: string,
  password: string,
  google = false,
) {
  try {
    if (google) await authenticateGoogle(auth);
    else await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    throw translateFirebaseError(error);
  }
}
