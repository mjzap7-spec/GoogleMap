import { LanguageViewModel } from '../../../shared/i18n/LanguageViewModel';
import { ContactEditorViewModel } from '../../contacts/viewmodels/ContactEditorViewModel';
import type { LocationTracker } from '../../map/models/travel';
import type { AuthMode, AuthRepository, AuthUser, AvatarPicker } from '../models/auth';
import { AuthFormViewModel } from '../viewmodels/AuthFormViewModel';
import { SessionViewModel } from '../viewmodels/SessionViewModel';
import type { CityRepository } from '../models/city';
import { ProfileViewModel } from '../viewmodels/ProfileViewModel';
import { PasswordViewModel } from '../viewmodels/PasswordViewModel';
import type { ContactRepository } from '../../contacts/models/contact';
import { ContactsViewModel } from '../../contacts/viewmodels/ContactsViewModel';
import { MapViewModel } from '../../map/viewmodels/MapViewModel';
import type { MapPreferences } from '../../map/models/map';

export interface AuthServices {
  repository: AuthRepository;
  avatarPicker: AvatarPicker;
  cities: CityRepository;
  contacts: ContactRepository;
  mapPreferences?: MapPreferences;
  locationTracker?: LocationTracker;
}

/** Pure composition contract: adapters are selected by bootstrap, never by a View or hook. */
export function createAuthDependencies(services: AuthServices) {
  const language = new LanguageViewModel(services.mapPreferences);
  const session = new SessionViewModel(services.repository);
  return {
    session,
    language,
    createMapSettings: () => new MapViewModel(language),
    createMap: () => new MapViewModel(language, services.locationTracker),
    createContactEditor: (userId: string, contactId: string) =>
      new ContactEditorViewModel(services.contacts, userId, contactId),
    createContacts: (userId: string) => new ContactsViewModel(services.contacts, userId),
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
export type AuthDependencies = ReturnType<typeof createAuthDependencies>;
