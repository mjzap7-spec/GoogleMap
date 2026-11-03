import React from 'react';
import { router } from 'expo-router';
import { HelpView } from '../views/HelpView';
import { PageSurface } from '../../../shared/motion/PageSurface';
import { usePageTransition } from '../../../shared/motion/usePageTransition';

export function HelpScreen() {
  const transition = usePageTransition();
  return (
    <PageSurface transition={transition}>
      <HelpView onBack={() => transition.navigate(() => router.navigate('/'))} />
    </PageSurface>
  );
}
