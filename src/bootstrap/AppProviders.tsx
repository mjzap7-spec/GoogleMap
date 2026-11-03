import { LanguageProvider } from '../shared/i18n/LanguageProvider';
// @refresh reset
// Recreate the service graph when its factory changes during development.
import React, { useState, type PropsWithChildren } from 'react';
import { ThemeProvider } from 'expo-router';
import { View } from 'react-native';
import { AuthProvider } from '../features/auth/bindings/AuthProvider';
import type { AuthDependencies } from '../features/auth/bindings/dependencies';
import { ui } from '../shared/ui/styles';
import { navigationTheme } from '../shared/theme/navigationTheme';
import { createAppDependencies } from './createAppDependencies';
import './configureSurface';
import '../shared/theme/global.css';

export function AppProviders({
  children,
  dependencies,
}: PropsWithChildren<{ dependencies?: AuthDependencies }>) {
  const [selected] = useState(() => dependencies ?? createAppDependencies());
  return (
    <View style={ui.screen} collapsable={false}>
      <ThemeProvider value={navigationTheme}>
        <LanguageProvider model={selected.language}>
          <AuthProvider dependencies={selected}>{children}</AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </View>
  );
}
