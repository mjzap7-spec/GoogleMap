import React from 'react';
import { router } from 'expo-router';
import { useMap } from '../bindings/useMap';
import { DeveloperTestingView } from '../views/DeveloperTestingView';
export function DeveloperTesting() {
  const { state, commands } = useMap();
  if (!state.developerTestingEnabled) return null;
  return (
    <DeveloperTestingView
      count={state.testUserCount}
      hasLocation={!!state.live}
      onChange={commands.setTestUserCount}
      onViewMap={() => router.navigate('/')}
    />
  );
}
