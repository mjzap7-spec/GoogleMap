import type { FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const initializePlatformFirestore = (app: FirebaseApp) => getFirestore(app);
