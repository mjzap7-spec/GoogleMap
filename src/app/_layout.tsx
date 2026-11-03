import React from 'react';
import { AppProviders } from '../bootstrap/AppProviders';
import { AuthNavigator } from '../navigation/AuthNavigator';
import '../bootstrap/splash';

export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  return (
    <AppProviders>
      <AuthNavigator />
    </AppProviders>
  );
}
