import React, { memo, useEffect, useState, type PropsWithChildren } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../../../shared/motion/useReducedMotion';

/** Mount the contacts list on first use and retain its search and scroll position afterward. */
export const HomeDropdown = memo(
  function HomeDropdown({
    open,
    children,
    style,
  }: PropsWithChildren<{ open: boolean; style?: StyleProp<ViewStyle> }>) {
    const [progress] = useState(() => new Animated.Value(0));
    const [hasOpened, setHasOpened] = useState(open);
    const reducedMotion = useReducedMotion();
    useEffect(() => {
      if (open) setHasOpened(true);
    }, [open]);
    const mounted = hasOpened || open;
    useEffect(() => {
      if (!mounted) return;
      progress.stopAnimation();
      if (reducedMotion !== false) {
        progress.setValue(open ? 1 : 0);
        return;
      }
      const animation = Animated.timing(progress, {
        toValue: open ? 1 : 0,
        duration: open ? 120 : 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      });
      animation.start();
      return () => animation.stop();
    }, [open, mounted, progress, reducedMotion]);
    if (!mounted) return null;
    return (
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        aria-hidden={!open}
        style={[
          style,
          {
            opacity: progress,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    );
  },
  (previous, next) => !previous.open && !next.open,
);
