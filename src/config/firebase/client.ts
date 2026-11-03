import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializePlatformAuth } from './persistence';
import { initializePlatformFirestore } from './firestore';
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);
let auth: ReturnType<typeof getAuth> | undefined;
let databaseReady = false;
export function getFirebaseApp() {
  getFirebaseAuth();
  const app = getApp();
  // Configure transport before any profile, contact, or presence listener starts.
  if (!databaseReady) {
    initializePlatformFirestore(app);
    databaseReady = true;
  }
  return app;
}
export function getFirebaseAuth() {
  if (!isFirebaseConfigured) throw new Error('Configure Firebase in .env first.');
  if (auth) return auth;
  const app =
    getApps().find((candidate) => candidate.name === '[DEFAULT]') ?? initializeApp(config);
  try {
    auth = initializePlatformAuth(app);
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'auth/already-initialized'
    )
      throw error;
    // Fast Refresh can re-evaluate this module while the configured Auth instance survives.
    auth = getAuth(app);
  }
  return auth;
}
