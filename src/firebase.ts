import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializePlatformAuth } from './persistence';
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const isFirebaseConfigured = Object.values(config).every(Boolean);
export function getFirebaseAuth() {
  if (!isFirebaseConfigured) throw new Error('Configure Firebase in .env first.');
  if (getApps().length) return getAuth(getApp());
  const app = initializeApp(config);
  return initializePlatformAuth(app);
}
