import { FirebaseSharingRepository } from '../features/contacts/data/FirebaseSharingRepository';
import { FirebaseChatRepository } from '../features/chat/data/FirebaseChatRepository';
import { ExpoLocationTracker } from '../features/map/data/ExpoLocationTracker';
import { createAuthDependencies, type AuthServices } from '../features/auth/bindings/dependencies';
import { FirebaseAuthRepository } from '../features/auth/data/FirebaseAuthRepository';
import { ExpoAvatarPicker } from '../features/auth/data/ExpoAvatarPicker';
import { OpenMeteoCityRepository } from '../features/auth/data/OpenMeteoCityRepository';
import { CloudinaryAvatarStorage } from '../features/auth/data/CloudinaryAvatarStorage';
import { FirebaseContactRepository } from '../features/contacts/data/FirebaseContactRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoredProfileCache } from '../features/auth/data/StoredProfileCache';
import { StoredMapPreferences } from '../features/map/data/StoredMapPreferences';

/** The only place selecting concrete authentication and device adapters. */
export function createAppDependencies(overrides: Partial<AuthServices> = {}) {
  return createAuthDependencies({
    developerTesting: typeof __DEV__ !== 'undefined' && __DEV__,
    repository:
      overrides.repository ??
      new FirebaseAuthRepository(
        new CloudinaryAvatarStorage(),
        new StoredProfileCache(AsyncStorage),
      ),
    avatarPicker: overrides.avatarPicker ?? new ExpoAvatarPicker(),
    cities: overrides.cities ?? new OpenMeteoCityRepository(),
    sharing: overrides.sharing ?? new FirebaseSharingRepository(),
    chat: overrides.chat ?? new FirebaseChatRepository(),
    contacts: overrides.contacts ?? new FirebaseContactRepository(),
    locationTracker: overrides.locationTracker ?? new ExpoLocationTracker(),
    mapPreferences: overrides.mapPreferences ?? new StoredMapPreferences(AsyncStorage),
  });
}
