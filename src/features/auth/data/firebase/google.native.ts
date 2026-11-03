import { GoogleAuthProvider, signInWithCredential, type Auth } from 'firebase/auth';
import Constants from 'expo-constants';
import { AuthFailure } from '../../models/AuthFailure';
import { isGoogleNativeModuleAvailable } from '../../../../config/googleNative';

let configuredClient: string | undefined;

export async function authenticateGoogle(auth: Auth) {
  if (!isGoogleNativeModuleAvailable()) throw new AuthFailure('google-native-unavailable');
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (
    !webClientId ||
    (Constants.platform?.ios && !iosClientId) ||
    Constants.executionEnvironment === 'storeClient'
  )
    throw new AuthFailure('google-not-configured');
  // Load only when requested, so Expo Go can still use email/password authentication.
  const { GoogleSignin, isSuccessResponse } =
    await import('@react-native-google-signin/google-signin');
  const client = `${webClientId}:${iosClientId ?? ''}`;
  if (configuredClient !== client) {
    GoogleSignin.configure({ webClientId, iosClientId });
    configuredClient = client;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) throw new AuthFailure('auth-cancelled');
  if (!result.data.idToken) throw new AuthFailure('google-not-configured');
  return signInWithCredential(auth, GoogleAuthProvider.credential(result.data.idToken));
}
