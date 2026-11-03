import { TurboModuleRegistry } from 'react-native';

/** Check before importing the SDK, which enforces that its native module exists. */
export function isGoogleNativeModuleAvailable() {
  return TurboModuleRegistry.get('RNGoogleSignin') !== null;
}
