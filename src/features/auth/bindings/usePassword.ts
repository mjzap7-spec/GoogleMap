import { useActionNotices } from '../../../shared/ui/Feedback';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuthDependencies } from './AuthProvider';

export function usePassword(userId: string) {
  const { createPassword } = useAuthDependencies();
  const [viewModel] = useState(() => createPassword(userId));
  useActionNotices(viewModel);
  const state = useSyncExternalStore(
    viewModel.subscribe,
    viewModel.getSnapshot,
    viewModel.getSnapshot,
  );
  useEffect(() => () => viewModel.dispose(), [viewModel]);
  return { state, setField: viewModel.setField, save: viewModel.save };
}
