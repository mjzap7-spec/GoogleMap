import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import type { AuthRepository, AuthUser, UserProfile } from '../models/auth';
import { validateProfile } from '../models/validation';
import { authErrorMessage } from '../models/AuthFailure';
export interface SessionState {
  readonly user: AuthUser | null;
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string;
  readonly registrationProfilePending: boolean;
  readonly profileRequired: boolean;
}
export class SessionViewModel extends ObservableViewModel<SessionState> {
  private generation = 0;
  private unsubscribe?: () => void;
  constructor(private readonly repository: AuthRepository) {
    super({
      user: null,
      loading: repository.isConfigured,
      busy: false,
      error: '',
      registrationProfilePending: false,
      profileRequired: false,
    });
  }
  start = () => {
    this.stop();
    if (!this.repository.isConfigured) {
      this.update({ loading: false });
      return;
    }
    const generation = this.generation;
    this.update({ loading: true, error: '' });
    try {
      this.unsubscribe = this.repository.observeSession(
        (user) => {
          if (generation === this.generation)
            this.update({
              user,
              loading: false,
              error: '',
              registrationProfilePending: user ? this.state.registrationProfilePending : false,
              profileRequired:
                user?.profileStatus === 'ready' &&
                Boolean(
                  validateProfile({
                    fullName: user.fullName ?? '',
                    birthday: user.birthday ?? '',
                    location: user.location ?? '',
                    avatar: null,
                  }),
                ),
            });
        },
        (error) => {
          if (generation === this.generation)
            this.update({ loading: false, error: authErrorMessage(error) });
        },
      );
    } catch (error) {
      this.update({ loading: false, error: authErrorMessage(error) });
    }
  };
  stop = () => {
    this.generation++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.update({ busy: false, registrationProfilePending: false });
  };
  beginRegistration = () => this.update({ registrationProfilePending: true });
  profileSaved = (userId: string, profile: UserProfile, avatarUrl: string | null) => {
    if (this.state.user?.id !== userId) return;
    this.update({
      user: {
        ...this.state.user,
        fullName: profile.fullName,
        birthday: profile.birthday,
        location: profile.location,
        avatarUrl,
        profileStatus: 'ready',
      },
      profileRequired: false,
    });
  };
  cancelRegistrationLanding = () => this.update({ registrationProfilePending: false });
  acknowledgeRegistrationLanding = () => {
    if (this.state.registrationProfilePending) this.update({ registrationProfilePending: false });
  };
  logout = async (): Promise<void> => {
    if (this.state.busy) return;
    const generation = this.generation;
    this.update({ busy: true, error: '' });
    try {
      await this.repository.signOut();
      // The repository's session observer is the source of truth for routing.
    } catch (error) {
      if (generation === this.generation) this.update({ error: authErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ busy: false });
    }
  };
}
