import { FeedbackProvider } from '../shared/ui/Feedback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DismissalReceipts } from '../shared/feedback/DismissalReceipts';
import { LanguageProvider } from '../shared/i18n/LanguageProvider';
// @refresh reset
// Recreate the service graph when its factory changes during development.
import React, { useState, type PropsWithChildren } from 'react';
import { ThemeProvider } from 'expo-router';
import { LogBox, Platform, View } from 'react-native';
import { AuthProvider } from '../features/auth/bindings/AuthProvider';
import { useSession } from '../features/auth/bindings/useSession';
import type { AuthDependencies } from '../features/auth/bindings/dependencies';
import { ui } from '../shared/ui/styles';
import { navigationTheme } from '../shared/theme/navigationTheme';
import { createAppDependencies } from './createAppDependencies';
import './configureSurface';
import '../shared/theme/global.css';

if (__DEV__ && Platform.OS !== 'web') {
  // Firestore retries this initial watch automatically. Keep the native log for diagnosis.
  LogBox.ignoreLogs([
    /Firestore \([^)]+\): Could not reach Cloud Firestore backend\. Backend didn't respond within 10 seconds\./,
  ]);
}

const feedbackReceipts = new DismissalReceipts(AsyncStorage);
function AccountFeedback({ children }: PropsWithChildren) {
  const { state } = useSession();
  return (
    <FeedbackProvider receipts={feedbackReceipts} scope={state.user?.id ?? 'signed-out'}>
      {children}
    </FeedbackProvider>
  );
}
export function AppProviders({
  children,
  dependencies,
}: PropsWithChildren<{ dependencies?: AuthDependencies }>) {
  const [selected] = useState(() => dependencies ?? createAppDependencies());
  return (
    <View style={ui.screen} collapsable={false}>
      <ThemeProvider value={navigationTheme}>
        <LanguageProvider model={selected.language}>
          <AuthProvider dependencies={selected}>
            <AccountFeedback>{children}</AccountFeedback>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </View>
  );
}
