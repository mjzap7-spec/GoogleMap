import { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
export const initializePlatformAuth = (app: FirebaseApp) => getAuth(app);
