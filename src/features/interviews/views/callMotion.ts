import { usePressMotion } from '../../../shared/motion/usePressMotion';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';

const driver = { useNativeDriver: Platform.OS !== 'web', isInteraction: false };

export function useCallPress(disabled = false) {
  return usePressMotion(disabled, 0.94);
}

/** Short transitions on phase changes only; no looping animation during media playback. */
export function useCallStageMotion(phase: string) {
  const [progress] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useEffect(() => {
    progress.stopAnimation();
    if (reduced !== false) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      ...driver,
    });
    animation.start();
    return () => animation.stop();
  }, [phase, reduced, progress]);
  return {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }],
  };
}
