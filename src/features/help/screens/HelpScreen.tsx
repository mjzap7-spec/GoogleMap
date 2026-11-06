import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { HelpView } from '../views/HelpView';
import { PageSurface } from '../../../shared/motion/PageSurface';
import { usePageTransition } from '../../../shared/motion/usePageTransition';

export function HelpScreen() {
  const transition = usePageTransition();
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  return (
    <PageSurface transition={transition}>
      <HelpView
        key={topic}
        topic={topic}
        onBack={() =>
          transition.navigate(() => (router.canGoBack() ? router.back() : router.navigate('/')))
        }
      />
    </PageSurface>
  );
}
