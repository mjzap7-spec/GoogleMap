import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import type { AuthForm, AuthMode, AuthRepository } from '../models/auth';
import { AuthFailure, authErrorMessage } from '../models/AuthFailure';
import { validateAuthForm } from '../models/validation';
export interface AuthFormState extends AuthForm {
  readonly busy: boolean;
  readonly show: boolean;
  readonly error: string;
  readonly notice: string;
  readonly registrationComplete: boolean;
  readonly resetRequested: boolean;
  readonly googleBusy: boolean;
}
export class AuthFormViewModel extends ObservableViewModel<AuthFormState> {
  private generation = 0;
  constructor(
    readonly mode: AuthMode,
    private readonly repository: AuthRepository,
    private readonly registration?: { begin: () => void; failed: () => void },
  ) {
    super({
      email: '',
      password: '',
      confirm: '',

      registrationComplete: false,
      resetRequested: false,
      googleBusy: false,
      busy: false,
      show: false,
      error: '',
      notice: '',
    });
  }
  get isConfigured() {
    return this.repository.isConfigured;
  }
  setEmail = (email: string) => {
    if (!this.state.busy) this.update({ email, error: '', notice: '' });
  };
  setPassword = (password: string) => {
    if (!this.state.busy) this.update({ password, error: '' });
  };
  setConfirm = (confirm: string) => {
    if (!this.state.busy) this.update({ confirm, error: '' });
  };
  togglePassword = () => this.update({ show: !this.state.show });
  clearSensitiveFields = () => this.update({ password: '', confirm: '', show: false });
  /** Invalidate pending commands when the screen leaves; late results cannot revive its state. */
  dispose = () => {
    this.generation++;
    this.update({
      password: '',
      confirm: '',

      registrationComplete: false,
      resetRequested: false,
      googleBusy: false,
      show: false,
      busy: false,
      error: '',
      notice: '',
    });
  };
  submit = async (): Promise<void> => {
    if (this.state.busy || this.state.registrationComplete) return;
    this.update({ error: '', notice: '' });
    if (!this.isConfigured) {
      this.update({ error: new AuthFailure('not-configured').message });
      return;
    }
    const validation = validateAuthForm(this.mode, this.state);
    if (validation) {
      this.update({ error: validation });
      return;
    }
    const { password } = this.state;
    const email = this.state.email.trim();
    const generation = this.generation;
    this.update({ busy: true });
    try {
      if (this.mode === 'signup') this.registration?.begin();
      if (this.mode === 'reset') await this.repository.resetPassword(email);
      else if (this.mode === 'signup') await this.repository.signUp(email, password);
      else await this.repository.signIn(email, password);
      if (generation !== this.generation) return;
      this.clearSensitiveFields();
      if (this.mode === 'signup')
        this.update({
          registrationComplete: true,
        });
      if (this.mode === 'reset')
        this.update({
          resetRequested: true,
          notice:
            'If this email has an account, a reset link was requested. Check your inbox and Spam/Junk folder.',
        });
    } catch (error) {
      if (this.mode === 'signup') this.registration?.failed();
      if (generation === this.generation) this.update({ error: authErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ busy: false });
    }
  };

  continueWithGoogle = async (): Promise<void> => {
    if (this.mode === 'reset' || this.state.busy || this.state.registrationComplete) return;
    this.update({ error: '', notice: '' });
    if (!this.isConfigured) {
      this.update({ error: new AuthFailure('not-configured').message });
      return;
    }
    const generation = this.generation;
    this.update({ busy: true, googleBusy: true });
    try {
      if (this.mode === 'signup') this.registration?.begin();
      if (this.mode === 'signup') await this.repository.signUpWithGoogle();
      else await this.repository.signInWithGoogle();
      if (generation !== this.generation) return;
      this.clearSensitiveFields();
      if (this.mode === 'signup')
        this.update({
          registrationComplete: true,
        });
    } catch (error) {
      if (this.mode === 'signup') this.registration?.failed();
      if (generation === this.generation) this.update({ error: authErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ busy: false, googleBusy: false });
    }
  };
}

/** Public command surface exposed to views; implementation details stay in the ViewModel. */
export type AuthFormCommands = Pick<
  AuthFormViewModel,
  'setEmail' | 'setPassword' | 'setConfirm' | 'togglePassword' | 'submit' | 'continueWithGoogle'
>;
