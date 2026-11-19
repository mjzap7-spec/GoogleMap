import { DirectTransfersViewModel } from '../features/chat/viewmodels/DirectTransfersViewModel';
import type {
  TransferRepository,
  DirectFileDevice,
  DataTransferTransport,
} from '../features/chat/models/directTransfer';
import { SharingViewModel } from '../features/contacts/viewmodels/SharingViewModel';
import type { SharingRepository } from '../features/contacts/models/sharing';
import { ChatViewModel } from '../features/chat/viewmodels/ChatViewModel';
import { AttachmentsViewModel } from '../features/chat/viewmodels/AttachmentsViewModel';
import type { ChatFiles } from '../features/chat/models/attachments';
import { UnreadChatsViewModel } from '../features/chat/viewmodels/UnreadChatsViewModel';
import { GroupRosterViewModel } from '../features/chat/viewmodels/GroupRosterViewModel';
import { GroupChatActivityViewModel } from '../features/chat/viewmodels/GroupChatActivityViewModel';
import type { ChatPeer, ChatRepository } from '../features/chat/models/chat';
import type { LocalChatHistory } from '../features/chat/models/localChatHistory';
import { LanguageViewModel } from '../shared/i18n/LanguageViewModel';
import { ContactEditorViewModel } from '../features/contacts/viewmodels/ContactEditorViewModel';
import type { LocationTracker } from '../features/map/models/travel';
import type {
  AuthMode,
  AuthRepository,
  AuthUser,
  AvatarPicker,
} from '../features/auth/models/auth';
import { AuthFormViewModel } from '../features/auth/viewmodels/AuthFormViewModel';
import { SessionViewModel } from '../features/auth/viewmodels/SessionViewModel';
import type { CityRepository } from '../features/auth/models/city';
import { ProfileViewModel } from '../features/auth/viewmodels/ProfileViewModel';
import { PasswordViewModel } from '../features/auth/viewmodels/PasswordViewModel';
import type { ContactRepository } from '../features/contacts/models/contact';
import { ContactsViewModel } from '../features/contacts/viewmodels/ContactsViewModel';
import { MapViewModel } from '../features/map/viewmodels/MapViewModel';
import type { MapPreferences } from '../features/map/models/map';
import type { InterviewRepository, CallMedia } from '../features/interviews/models/interview';
import { InterviewViewModel } from '../features/interviews/viewmodels/InterviewViewModel';

export interface AppServices {
  files?: ChatFiles;
  transfers?: TransferRepository;
  transferFiles?: DirectFileDevice;
  transferTransport?: DataTransferTransport;
  repository: AuthRepository;
  avatarPicker: AvatarPicker;
  cities: CityRepository;
  contacts: ContactRepository;
  sharing?: SharingRepository;
  chat?: ChatRepository;
  chatHistory?: LocalChatHistory;
  developerTesting?: boolean;
  mapPreferences?: MapPreferences;
  locationTracker?: LocationTracker;
  interviews?: InterviewRepository;
  callMedia?: CallMedia;
}

/** Pure composition contract: adapters are selected by bootstrap, never by a View or hook. */
export function createViewModels(services: AppServices) {
  const chat = services.chat;
  const language = new LanguageViewModel(services.mapPreferences);
  const session = new SessionViewModel(services.repository);
  return {
    createDirectTransfers: (uid: string, peer: ChatPeer) =>
      new DirectTransfersViewModel(
        services.transfers,
        services.transferFiles,
        services.transferTransport,
        uid,
        peer,
      ),
    createAttachments: (uid: string, peer: ChatPeer) =>
      new AttachmentsViewModel(services.files, chat, uid, peer),
    createInterviews: (uid: string, identity: () => { name: string; avatar: string | null }) =>
      new InterviewViewModel(uid, identity, services.interviews, services.callMedia),
    createSharing: (user: AuthUser) => new SharingViewModel(services.sharing, user),
    createGroupRoster: (uid: string, groupId: string) =>
      new GroupRosterViewModel(chat, uid, groupId),
    createChat: (uid: string, peer?: ChatPeer) =>
      new ChatViewModel(chat, uid, peer, services.chatHistory),
    createUnreadChats: (uid: string) => new UnreadChatsViewModel(chat, uid),
    createGroupChatActivity: (uid: string) => new GroupChatActivityViewModel(chat, uid),
    session,
    language,
    createMapSettings: () => new MapViewModel(language),
    createMap: () =>
      new MapViewModel(
        language,
        services.locationTracker,
        Date.now,
        services.developerTesting === true,
      ),
    createContactEditor: (
      userId: string,
      contactId: string,
      observe?: ContactRepository['observe'],
    ) => new ContactEditorViewModel(services.contacts, userId, contactId, observe),
    createContacts: (userId: string) =>
      new ContactsViewModel(services.contacts, userId, !services.sharing),
    createPassword: (userId: string) => new PasswordViewModel(services.repository, userId),
    createProfile: (user: AuthUser) =>
      new ProfileViewModel(
        services.repository,
        services.avatarPicker,
        services.cities,
        user,
        (profile, avatarUrl) => session.profileSaved(user.id, profile, avatarUrl),
      ),
    createForm: (mode: AuthMode) =>
      new AuthFormViewModel(mode, services.repository, {
        begin: session.beginRegistration,
        failed: session.cancelRegistrationLanding,
      }),
  };
}
export type AppDependencies = ReturnType<typeof createViewModels>;
