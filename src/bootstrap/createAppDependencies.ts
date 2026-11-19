import { FirebaseTransferRepository } from '../features/chat/data/firebase/FirebaseTransferRepository';
import { DirectFileDevice } from '../features/chat/data/device/DirectFileDevice';
import { DirectTransferTransport } from '../features/chat/data/device/DirectTransferTransport';
import { FirebaseSharingRepository } from '../features/contacts/data/firebase/FirebaseSharingRepository';
import { FirebaseChatRepository } from '../features/chat/data/firebase/FirebaseChatRepository';
import { StoredChatHistory } from '../features/chat/data/storage/StoredChatHistory';
import { DeviceChatRepository } from '../features/chat/data/device/DeviceChatRepository';
import { ExpoLocationTracker } from '../features/map/data/device/ExpoLocationTracker';
import { createViewModels, type AppServices } from '../application/createViewModels';
import { FirebaseAuthRepository } from '../features/auth/data/firebase/FirebaseAuthRepository';
import { ExpoAvatarPicker } from '../features/auth/data/device/ExpoAvatarPicker';
import { OpenMeteoCityRepository } from '../features/auth/data/http/OpenMeteoCityRepository';
import { CloudinaryAvatarStorage } from '../features/auth/data/http/CloudinaryAvatarStorage';
import { FirebaseContactRepository } from '../features/contacts/data/firebase/FirebaseContactRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoredProfileCache } from '../features/auth/data/storage/StoredProfileCache';
import { StoredMapPreferences } from '../features/map/data/storage/StoredMapPreferences';
import { FirebaseInterviewRepository } from '../features/interviews/data/firebase/FirebaseInterviewRepository';
import { DeviceCallMedia } from '../features/interviews/data/device/DeviceCallMedia';
import { PrivateChatFiles } from '../features/chat/data/http/PrivateChatFiles';

/** The only place selecting concrete authentication and device adapters. */
export function createAppDependencies(overrides: Partial<AppServices> = {}) {
  const chatHistory = overrides.chatHistory ?? new StoredChatHistory(AsyncStorage);
  const remoteChat = overrides.chat ?? new FirebaseChatRepository();
  return createViewModels({
    transfers: overrides.transfers ?? new FirebaseTransferRepository(),
    transferFiles: overrides.transferFiles ?? new DirectFileDevice(),
    transferTransport: overrides.transferTransport ?? new DirectTransferTransport(),
    files: overrides.files ?? new PrivateChatFiles(),
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
    chat: new DeviceChatRepository(remoteChat, chatHistory),
    chatHistory,
    interviews: overrides.interviews ?? new FirebaseInterviewRepository(),
    callMedia: overrides.callMedia ?? new DeviceCallMedia(),
    contacts: overrides.contacts ?? new FirebaseContactRepository(),
    locationTracker: overrides.locationTracker ?? new ExpoLocationTracker(),
    mapPreferences: overrides.mapPreferences ?? new StoredMapPreferences(AsyncStorage),
  });
}
