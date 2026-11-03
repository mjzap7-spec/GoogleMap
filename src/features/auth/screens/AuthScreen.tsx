import React, { useCallback, type ComponentType } from 'react';
import { router, useCanGoBack } from 'expo-router';
import { authRoutes } from '../../../navigation/authRoutes';
import { usePasswordResetReturn } from '../../../navigation/usePasswordResetReturn';
import { PageSurface } from '../../../shared/motion/PageSurface';
import { usePageTransition } from '../../../shared/motion/usePageTransition';
import { useAuthForm } from '../bindings/useAuthForm';
import { useSession } from '../bindings/useSession';
import type { AuthMode } from '../models/auth';
import { SignInView } from '../views/SignInView';
import { SignUpView } from '../views/SignUpView';
import { ResetPasswordView } from '../views/ResetPasswordView';
import type { AuthViewProps } from '../views/types';

const views: Record<AuthMode, ComponentType<AuthViewProps>> = {
  signin: SignInView,
  signup: SignUpView,
  reset: ResetPasswordView,
};

/** Binds a ViewModel to a pure View and handles only route-level navigation. */
export function AuthScreen({ mode }: { mode: AuthMode }) {
  const { state, commands, isConfigured } = useAuthForm(mode);
  const { state: session } = useSession();
  const transition = usePageTransition();
  const { navigate } = transition;
  const FormView = views[mode];
  const canGoBack = useCanGoBack();
  const returnToSignIn = useCallback(() => {
    navigate(() => router.dismissTo(authRoutes.signin));
  }, [navigate]);
  usePasswordResetReturn(mode === 'reset' && state.resetRequested, returnToSignIn);

  return (
    <PageSurface transition={transition}>
      <FormView
        state={state}
        commands={commands}
        isConfigured={isConfigured}
        sessionError={session.error}
        onBack={() =>
          transition.navigate(() => {
            if (router.canGoBack()) router.back();
            else if (mode !== 'signin') router.replace(authRoutes.signin);
          })
        }
        backDisabled={!canGoBack && mode === 'signin'}
        onNavigate={(next) =>
          transition.navigate(() => {
            if (next === 'signin') router.dismissTo(authRoutes.signin);
            else router.push(authRoutes[next]);
          })
        }
      />
    </PageSurface>
  );
}
