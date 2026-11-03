import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useReducedMotion } from './useReducedMotion';
import { motion } from './tokens';

/** Native screens use the stack transition; web gets a matching exit/enter sequence. */
export function usePageTransition() {
  const [progress] = useState(() => new Animated.Value(Platform.OS === 'web' ? 0 : 1));
  const [leaving, setLeaving] = useState(false);
  const locked = useRef(false);
  const pending = useRef<(() => void) | null>(null);
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();

  useEffect(() => {
    if (!focused) {
      pending.current = null;
      locked.current = false;
      progress.stopAnimation();
      return;
    }
    if (reducedMotion === null) return;
    // Complete an in-flight navigation if the motion preference changes mid-transition.
    if (pending.current) {
      const action = pending.current;
      pending.current = null;
      action();
      return;
    }
    locked.current = false;
    setLeaving(false);
    if (Platform.OS !== 'web' || reducedMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.pageEnterDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      progress.stopAnimation();
    };
  }, [focused, reducedMotion, progress]);

  useEffect(
    () => () => {
      pending.current = null;
      progress.stopAnimation();
    },
    [progress],
  );

  const navigate = useCallback(
    (action: () => void) => {
      if (locked.current) return;
      locked.current = true;
      Keyboard.dismiss();
      if (Platform.OS !== 'web' || reducedMotion !== false || motion.pageExitDuration === 0) {
        action();
        return;
      }
      pending.current = action;
      setLeaving(true);
      progress.stopAnimation();
      Animated.timing(progress, {
        toValue: 0,
        duration: motion.pageExitDuration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished || !pending.current) return;
        const next = pending.current;
        pending.current = null;
        next();
      });
    },
    [progress, reducedMotion],
  );

  return {
    navigate,
    leaving,
    style: {
      flex: 1,
      opacity: progress,
    },
  };
}
