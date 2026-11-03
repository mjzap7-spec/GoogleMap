import { useSyncExternalStore } from 'react';
import { useAuthDependencies } from './AuthProvider';

export function useSession() {
  const { session } = useAuthDependencies();
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return {
    state,
    logout: session.logout,
    retry: session.start,
    acknowledgeRegistrationLanding: session.acknowledgeRegistrationLanding,
  };
}
