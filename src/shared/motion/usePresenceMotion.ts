import { useLayoutEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

/** Keep an overlay mounted through its exit, then release its hidden UI work. */
export function usePresenceMotion(visible: boolean) {
  const [retained, setRetained] = useState(visible);
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  // Derive retention before commit, avoiding a second layout pass on every open.
  if (visible && !retained) setRetained(true);
  if (!visible && reduced !== false && retained) setRetained(false);
  useLayoutEffect(() => {
    let current = true;
    progress.stopAnimation();
    if (reduced !== false) {
      progress.setValue(visible ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 160 : 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (current && finished && !visible) setRetained(false);
    });
    return () => {
      current = false;
      animation.stop();
    };
  }, [visible, reduced, progress]);
  return { mounted: visible || retained, progress };
}
