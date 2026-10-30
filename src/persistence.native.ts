import { FirebaseApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
// Firebase's public declarations omit this React Native runtime export.
// @ts-expect-error Available in the React Native bundle (see Expo auth setup guide).
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
export const initializePlatformAuth = (app: FirebaseApp) => initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
