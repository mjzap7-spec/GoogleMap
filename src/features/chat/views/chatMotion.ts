import { useEffect, useLayoutEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { motion } from '../../../shared/motion/tokens';

const driver = { useNativeDriver: Platform.OS !== 'web', isInteraction: false };

/** Presentation-only motion. Cancelling the previous animation keeps rapid taps responsive. */
export function useChatProgress(value: number, duration = 160, nativeDriver = true) {
  const [progress] = useState(() => new Animated.Value(value));
  const reduced = useReducedMotion();
  useEffect(() => {
    progress.stopAnimation();
    if (reduced !== false) {
      progress.setValue(value);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      ...driver,
      useNativeDriver: nativeDriver && driver.useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [duration, nativeDriver, progress, reduced, value]);
  return progress;
}

export function useConversationMotion(identity?: string, offset = 8) {
  const [progress] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    progress.stopAnimation();
    if (reduced !== false) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.chatEnterDuration,
      easing: Easing.out(Easing.cubic),
      ...driver,
    });
    animation.start();
    return () => animation.stop();
  }, [identity, progress, reduced]);
  return {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
    transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
    ],
  };
}

export function useChatPress() {
  const [scale] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced !== false) scale.setValue(1);
    return () => scale.stopAnimation();
  }, [reduced, scale]);
  const animate = (value: number) => {
    scale.stopAnimation();
    if (reduced !== false) return;
    Animated.timing(scale, {
      toValue: value,
      duration: value === 1 ? 130 : 70,
      easing: Easing.out(Easing.quad),
      ...driver,
    }).start();
  };
  return {
    style: { transform: [{ scale }] },
    onPressIn: () => animate(0.985),
    onPressOut: () => animate(1),
  };
}

/** Animate just the newest bubble when it mounts, never the entire transcript on updates. */
export function useMessageArrival(newest: boolean) {
  const [animateOnMount] = useState(newest);
  const [progress] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    if (!animateOnMount || reduced !== false) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.messageEnterDuration,
      easing: Easing.out(Easing.cubic),
      ...driver,
    });
    animation.start();
    return () => animation.stop();
  }, [animateOnMount, progress, reduced]);
  return {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
  };
}
