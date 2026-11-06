import { useActionNotices } from '../../../shared/ui/Feedback';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import type { AuthMode } from '../models/auth';
import type { AuthFormCommands } from '../viewmodels/AuthFormViewModel';
import { useAuthDependencies } from './AuthProvider';

/** One form per route; React observes it and owns its lifetime. */
export function useAuthForm(mode: AuthMode) {
  const { createForm } = useAuthDependencies();
  const [viewModel] = useState(() => createForm(mode));
  useActionNotices(viewModel);
  const state = useSyncExternalStore(
    viewModel.subscribe,
    viewModel.getSnapshot,
    viewModel.getSnapshot,
  );
  const commands = useMemo<AuthFormCommands>(
    () => ({
      setEmail: viewModel.setEmail,
      setPassword: viewModel.setPassword,
      setConfirm: viewModel.setConfirm,
      togglePassword: viewModel.togglePassword,
      submit: viewModel.submit,
      continueWithGoogle: viewModel.continueWithGoogle,
    }),
    [viewModel],
  );

  useFocusEffect(useCallback(() => () => viewModel.dispose(), [viewModel]));
  return { state, commands, isConfigured: viewModel.isConfigured };
}
