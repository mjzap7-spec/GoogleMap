import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';
import { useAuthDependencies } from '../../auth/bindings/AuthProvider';
import type { AuthUser } from '../../auth/models/auth';
import type { Contact } from '../../contacts/models/contact';
import { interviewTarget } from '../models/interview';
import type { InterviewViewModel } from '../viewmodels/InterviewViewModel';

const Context = createContext<InterviewViewModel | null>(null);
export function InterviewsProvider({ user, children }: PropsWithChildren<{ user: AuthUser }>) {
  const { createInterviews } = useAuthDependencies();
  const [model] = useState(() =>
    createInterviews(user.id, () => ({
      name: user.fullName ?? '',
      avatar: user.avatarUrl ?? null,
    })),
  );
  useEffect(() => {
    model.setIdentity(() => ({ name: user.fullName ?? '', avatar: user.avatarUrl ?? null }));
  }, [model, user.fullName, user.avatarUrl]);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const change = () => model.setForeground(document.visibilityState === 'visible');
      change();
      document.addEventListener('visibilitychange', change);
      return () => {
        document.removeEventListener('visibilitychange', change);
        model.stop();
      };
    }
    model.setForeground(AppState.currentState !== 'background');
    // Ignore transient iOS "inactive" during the system permission dialog.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'inactive') model.setForeground(state === 'active');
    });
    return () => {
      subscription.remove();
      model.stop();
    };
  }, [model]);
  return <Context.Provider value={model}>{children}</Context.Provider>;
}
export function useInterviewModel() {
  const model = useContext(Context);
  if (!model) throw Error('InterviewsProvider required');
  return model;
}

export function useContactInterview() {
  const interviews = useInterviewModel();
  return useCallback(
    (contact: Contact) => {
      if (!contact.peerId || !contact.requestId) return;
      const target = interviewTarget(
        { peerId: contact.peerId, requestId: contact.requestId },
        contact.name,
        contact.avatarUrl,
      );
      if (target) interviews.choose(target);
    },
    [interviews],
  );
}
