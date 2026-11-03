import React, { type PropsWithChildren } from 'react';
import { Animated, View } from 'react-native';
import { ui } from '../ui/styles';
import type { usePageTransition } from './usePageTransition';

/** Never animate the page's base surface; fade only its content above it. */
export function PageSurface({
  children,
  transition,
}: PropsWithChildren<{ transition: ReturnType<typeof usePageTransition> }>) {
  return (
    <View style={ui.screen} collapsable={false}>
      <Animated.View style={transition.style} pointerEvents={transition.leaving ? 'none' : 'auto'}>
        {children}
      </Animated.View>
    </View>
  );
}
