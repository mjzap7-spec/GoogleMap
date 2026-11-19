import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useReducedMotion } from './useReducedMotion';
import { motion } from './tokens';

/** Shared feedback only: actions execute immediately, independently of animation completion. */
export function usePressMotion(disabled = false, pressedScale: number = motion.buttonPressedScale) {
  const [scale] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    return () => scale.stopAnimation();
  }, [disabled, reduced, scale]);
  const animate = useCallback(
    (pressed: boolean) => {
      scale.stopAnimation();
      if (disabled || reduced !== false) {
        scale.setValue(1);
        return;
      }
      Animated.timing(scale, {
        toValue: pressed ? pressedScale : 1,
        duration: pressed ? motion.buttonDuration : motion.buttonReleaseDuration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      }).start();
    },
    [disabled, pressedScale, reduced, scale],
  );
  const onPressIn = useCallback(() => animate(true), [animate]);
  const onPressOut = useCallback(() => animate(false), [animate]);
  return { style: { transform: [{ scale }] }, onPressIn, onPressOut };
}
