import { NoticeViewModel } from '../../../shared/feedback/NoticeViewModel';
import type { AuthRepository, AuthUser, AvatarPicker, UserProfile } from '../models/auth';
import type { City, CityRepository } from '../models/city';
import { validateProfile } from '../models/validation';
import { normalizePhoneNumber } from '../models/phoneNumber';
import { authErrorMessage } from '../models/AuthFailure';

export interface ProfileState extends UserProfile {
  phoneNumber: string;
  avatarUrl: string | null;
  cityQuery: string;
  selectedCity: City | null;
  suggestions: City[];
  searching: boolean;
  searched: boolean;
  locationError: string;
  busy: boolean;
  pickingAvatar: boolean;
  error: string;
  notice: string;
  dirty: boolean;
  saveComplete: boolean;
}

export class ProfileViewModel extends NoticeViewModel<ProfileState> {
  private generation = 0;
  private searchVersion = 0;
  private phoneEdited = false;
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  constructor(
    private repository: AuthRepository,
    private picker: AvatarPicker,
    private cities: CityRepository,
    user: AuthUser,
    private onSaved?: (profile: UserProfile, avatarUrl: string | null) => void,
  ) {
    super({
      fullName: user.fullName ?? '',
      birthday: user.birthday ?? '',
      location: user.location ?? '',
      phoneNumber: user.phoneNumber ?? '',
      avatarUrl: user.avatarUrl ?? null,
      avatar: null,
      cityQuery: user.location ?? '',
      selectedCity: null,
      suggestions: [],
      searching: false,
      searched: false,
      locationError: '',
      busy: false,
      pickingAvatar: false,
      error: '',
      notice: '',
      dirty: false,
      saveComplete: false,
    });
  }
  hydrate = (user: AuthUser) => {
    // The owner-only phone listener may resolve after the rest of the profile.
    // Never replace a typed number, or erase an unread number when saving other fields.
    if (!this.phoneEdited && !this.state.busy && user.phoneNumber !== undefined)
      this.update({ phoneNumber: user.phoneNumber });
    if (this.state.dirty || this.state.busy || this.state.pickingAvatar) return;
    this.update({
      fullName: user.fullName ?? '',
      birthday: user.birthday ?? '',
      location: user.location ?? '',
      cityQuery: user.location ?? '',
      avatarUrl: user.avatarUrl ?? null,
    });
  };
  setFullName = (fullName: string) => {
    if (fullName === this.state.fullName) return;
    if (!this.state.busy) this.update({ fullName, dirty: true, error: '', notice: '' });
  };
  setBirthday = (birthday: string) => {
    if (birthday === this.state.birthday) return;
    if (!this.state.busy) this.update({ birthday, dirty: true, error: '', notice: '' });
  };
  setPhoneNumber = (phoneNumber: string) => {
    if (this.state.busy || phoneNumber === this.state.phoneNumber) return;
    this.phoneEdited = true;
    this.update({ phoneNumber, dirty: true, error: '', notice: '' });
  };
  setCityQuery = (cityQuery: string) => {
    if (this.state.busy || cityQuery === this.state.cityQuery) return;
    this.cancelSearch();
    const version = this.searchVersion;
    this.update({
      cityQuery,
      location: '',
      selectedCity: null,
      suggestions: [],
      searching: cityQuery.trim().length >= 3,
      searched: false,
      locationError: '',
      dirty: true,
      error: '',
      notice: '',
    });
    if (cityQuery.trim().length < 3) return;
    this.timer = setTimeout(() => {
      void this.search(cityQuery, version);
    }, 150);
  };
  private async search(query: string, version: number) {
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const suggestions = await this.cities.search(query, controller.signal);
      if (version === this.searchVersion)
        this.update({ suggestions, searching: false, searched: true });
    } catch {
      if (version === this.searchVersion)
        this.update({
          searching: false,
          locationError: 'Could not load cities. Check your connection and type the city again.',
        });
    } finally {
      clearTimeout(timeout);
    }
  }
  selectCity = (city: City) => {
    if (this.state.busy || !this.state.suggestions.some((item) => item.id === city.id)) return;
    this.cancelSearch();
    this.update({
      selectedCity: city,
      cityQuery: city.label,
      location: city.label,
      suggestions: [],
      searching: false,
      searched: false,
      locationError: '',
      dirty: true,
      error: '',
      notice: '',
    });
  };
  removeAvatar = () => {
    if (!this.state.busy && !this.state.pickingAvatar)
      this.update({ avatar: null, avatarUrl: null, dirty: true, notice: '' });
  };
  pickAvatar = async () => {
    if (this.state.busy || this.state.pickingAvatar) return;
    const generation = this.generation;
    this.update({ pickingAvatar: true, error: '', notice: '' });
    try {
      const avatar = await this.picker.pick();
      if (generation === this.generation && avatar) this.update({ avatar, dirty: true });
    } catch (error) {
      if (generation === this.generation) this.update({ error: authErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ pickingAvatar: false });
    }
  };
  save = async () => {
    if (this.state.busy || this.state.pickingAvatar) return;
    const error = !this.state.location
      ? 'Choose your city from the suggestions.'
      : validateProfile(this.state);
    if (error) {
      this.update({ error, notice: '' });
      return;
    }
    if (!this.state.dirty) {
      this.update({ error: '', notice: 'Profile is already up to date.', saveComplete: true });
      return;
    }
    const generation = this.generation;
    const profile = {
      fullName: this.state.fullName.trim(),
      birthday: this.state.birthday,
      location: this.state.location,
      ...(this.phoneEdited ? { phoneNumber: normalizePhoneNumber(this.state.phoneNumber) } : {}),
      avatar: this.state.avatar,
    };
    this.update({ busy: true, error: '', notice: '' });
    try {
      const avatarUrl = await this.repository.saveProfile(profile, this.state.avatarUrl);
      if (generation === this.generation) {
        this.onSaved?.(profile, avatarUrl);
        this.phoneEdited = false;
        this.update({
          notice: 'Profile saved.',
          fullName: profile.fullName,
          phoneNumber: profile.phoneNumber ?? this.state.phoneNumber,
          avatar: null,
          avatarUrl,
          dirty: false,
          saveComplete: true,
        });
      }
    } catch (error) {
      if (generation === this.generation) this.update({ error: authErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ busy: false });
    }
  };
  private cancelSearch() {
    this.searchVersion++;
    clearTimeout(this.timer);
    this.controller?.abort();
  }
  dispose = () => {
    this.generation++;
    this.cancelSearch();
  };
}
