import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useSession } from '../features/auth/bindings/useSession';
import { SessionLoadingView } from '../features/auth/views/SessionLoadingView';
import { useReducedMotion } from '../shared/motion/useReducedMotion';
import { motion } from '../shared/motion/tokens';
import { colors } from '../shared/theme/colors';
import { AuthenticatedShell } from './AuthenticatedShell';
import { hideLaunchScreen } from '../bootstrap/splash';

export function AuthNavigator() {
  const { state } = useSession();
  const reducedMotion = useReducedMotion();
  // Hand off to the branded loading view as soon as React mounts; a slow
  // authentication/network restore must never leave the native splash stuck.
  useEffect(() => {
    hideLaunchScreen();
  }, []);
  if (state.loading) return <SessionLoadingView />;

  return (
    <AuthenticatedShell>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: Platform.OS !== 'web' && reducedMotion === false ? 'fade' : 'none',
          animationDuration: motion.nativePageDuration,
          animationTypeForReplace: 'push',
        }}
      >
        <Stack.Protected guard={!state.user}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="reset-password" />
        </Stack.Protected>
        <Stack.Protected guard={!!state.user}>
          <Stack.Screen name="index" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="contact/[id]" />
          <Stack.Screen name="contacts" />
          <Stack.Screen name="help" />
        </Stack.Protected>
      </Stack>
    </AuthenticatedShell>
  );
}
