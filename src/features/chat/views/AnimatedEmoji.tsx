import React, { memo, useEffect, useMemo, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet } from 'react-native';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { emojiMotion } from '../models/messageEmoji';

/** One short native animation, never an endless timer or a downloaded GIF. */
export const AnimatedEmoji = memo(function AnimatedEmoji({
  emoji,
  autoplay = false,
  replay = 0,
  disabled = false,
  size = 52,
}: {
  emoji: string;
  autoplay?: boolean;
  replay?: number;
  disabled?: boolean;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const kind = emojiMotion(emoji);
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (
      disabled ||
      reduced !== false ||
      (!autoplay && !replay) ||
      AppState.currentState !== 'active'
    )
      return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 920,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        animation.stop();
        progress.setValue(0);
      }
    });
    animation.start(() => subscription.remove());
    return () => {
      subscription.remove();
      animation.stop();
    };
  }, [autoplay, disabled, emoji, progress, reduced, replay]);
  const movement = useMemo(
    () => ({
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
            outputRange: kind === 'pulse' ? [1, 1.2, 1, 1.15, 1, 1] : [1, 1.06, 1, 1.04, 1, 1],
          }),
        },
        {
          translateY: progress.interpolate({
            inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
            outputRange: kind === 'bounce' ? [0, -10, 0, -6, 0, 0] : [0, -2, 0, -2, 0, 0],
          }),
        },
        {
          rotate: progress.interpolate({
            inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
            outputRange:
              kind === 'wiggle'
                ? ['0deg', '-12deg', '10deg', '-8deg', '6deg', '0deg']
                : ['0deg', '0deg', '0deg', '0deg', '0deg', '0deg'],
          }),
        },
      ],
    }),
    [kind, progress],
  );
  return (
    <Animated.Text
      testID="animated-emoji"
      style={[s.emoji, { fontSize: size, lineHeight: size + 14 }, movement]}
    >
      {emoji}
    </Animated.Text>
  );
});
const s = StyleSheet.create({
  emoji: { textAlign: 'center', paddingHorizontal: 6, paddingVertical: 4 },
});
