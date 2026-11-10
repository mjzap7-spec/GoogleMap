import { useActionNotices } from '../../../shared/ui/Feedback';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AuthUser } from '../models/auth';
import { useAuthDependencies } from './AuthProvider';

/** Mounted per user ID; never overwrite unsaved edits with observer updates. */
export function useProfile(user: AuthUser) {
  const { createProfile } = useAuthDependencies();
  const [viewModel] = useState(() => createProfile(user));
  useActionNotices(viewModel);
  const state = useSyncExternalStore(
    viewModel.subscribe,
    viewModel.getSnapshot,
    viewModel.getSnapshot,
  );
  useEffect(() => {
    viewModel.hydrate(user);
  }, [viewModel, user]);
  useEffect(() => () => viewModel.dispose(), [viewModel]);
  const commands = useMemo(
    () => ({
      setFullName: viewModel.setFullName,
      setBirthday: viewModel.setBirthday,
      setPhoneNumber: viewModel.setPhoneNumber,
      setCityQuery: viewModel.setCityQuery,
      selectCity: viewModel.selectCity,
      removeAvatar: viewModel.removeAvatar,
      pickAvatar: viewModel.pickAvatar,
      save: viewModel.save,
    }),
    [viewModel],
  );
  return { state, commands };
}
