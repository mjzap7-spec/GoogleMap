import type { AuthMode } from '../models/auth';
import type { AuthFormCommands, AuthFormState } from '../viewmodels/AuthFormViewModel';

/** Presentational views receive snapshots and commands, not a ViewModel instance. */
export interface AuthViewProps {
  state: Readonly<AuthFormState>;
  commands: AuthFormCommands;
  isConfigured: boolean;
  sessionError: string;
  onNavigate: (mode: AuthMode) => void;
  onBack: () => void;
  backDisabled: boolean;
}

export function isFormBusy(state: Readonly<AuthFormState>) {
  return state.busy;
}
