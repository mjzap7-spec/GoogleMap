import type { FirebaseApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

/** Prefer streaming, with long polling for networks that buffer responses. */
export const initializePlatformFirestore = (app: FirebaseApp) =>
  initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    // Keep the fallback short enough for buffering proxies.
    experimentalLongPollingOptions: { timeoutSeconds: 5 },
  });
