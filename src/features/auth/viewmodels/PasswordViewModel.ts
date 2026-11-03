import { ObservableViewModel } from '../../../shared/mvvm/ObservableViewModel';
import type { AuthRepository } from '../models/auth';
import { authErrorMessage } from '../models/AuthFailure';

export interface PasswordState {
  current: string;
  password: string;
  confirm: string;
  busy: boolean;
  error: string;
  notice: string;
}
export class PasswordViewModel extends ObservableViewModel<PasswordState> {
  private generation = 0;
  constructor(
    private repository: AuthRepository,
    private userId: string,
  ) {
    super({ current: '', password: '', confirm: '', busy: false, error: '', notice: '' });
  }
  setField = (field: 'current' | 'password' | 'confirm', value: string) => {
    if (!this.state.busy) this.update({ [field]: value, error: '', notice: '' });
  };
  save = async () => {
    if (this.state.busy) return;
    const { current, password, confirm } = this.state;
    const error = !current
      ? 'Enter your current password.'
      : password.length < 8
        ? 'Use at least 8 characters for your new password.'
        : password !== confirm
          ? 'Your passwords do not match.'
          : current === password
            ? 'Choose a different password.'
            : '';
    if (error) {
      this.update({ error, notice: '' });
      return;
    }
    const generation = this.generation;
    this.update({ busy: true, error: '', notice: '' });
    try {
      await this.repository.changePassword(this.userId, current, password);
      if (generation === this.generation)
        this.update({
          current: '',
          password: '',
          confirm: '',
          notice: 'Password updated successfully.',
        });
    } catch (error) {
      if (generation === this.generation)
        this.update({ current: '', error: authErrorMessage(error) });
    } finally {
      if (generation === this.generation) this.update({ busy: false });
    }
  };
  dispose = () => {
    this.generation++;
    this.update({ current: '', password: '', confirm: '', busy: false });
  };
}
