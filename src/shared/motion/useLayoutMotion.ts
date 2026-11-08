import { useCallback } from 'react';
import { LayoutAnimation } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

/** Animate an explicit disclosure action, never background data updates or typing. */
export function useLayoutMotion() {
  const reduced = useReducedMotion();
  return useCallback(() => {
    if (reduced !== false) return;
    LayoutAnimation.configureNext({
      duration: 200,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity },
      delete: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
        duration: 120,
      },
    });
  }, [reduced]);
}
