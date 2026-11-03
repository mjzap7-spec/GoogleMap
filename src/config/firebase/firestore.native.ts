import type { FirebaseApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

/** Avoid buffered streaming connections on native devices and emulator networks. */
export const initializePlatformFirestore = (app: FirebaseApp) =>
  initializeFirestore(app, {
    experimentalForceLongPolling: true,
    // Expo's native network inspector may buffer a response until it closes.
    // Close polls before Firestore's 10-second initial connection deadline.
    experimentalLongPollingOptions: { timeoutSeconds: 5 },
  });
