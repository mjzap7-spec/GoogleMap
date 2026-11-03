import { useTranslation } from '../i18n/LanguageProvider';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Text } from 'react-native';
import { motion } from '../motion/tokens';
import { useReducedMotion } from '../motion/useReducedMotion';
import { ui } from './styles';

/** Fade feedback without removing its layout space or shifting adjacent controls. */
export function Feedback({ error, notice = '' }: { error: string; notice?: string }) {
  const { t } = useTranslation();
  const [noticeState, setNoticeState] = useState({ value: notice, expired: false });
  if (noticeState.value !== notice) setNoticeState({ value: notice, expired: false });
  const message = error || (noticeState.value === notice && noticeState.expired ? '' : notice);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNoticeState({ value: notice, expired: true }), 2000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const isError = Boolean(error);
  const [content, setContent] = useState({ message, isError });
  const [opacity] = useState(() => new Animated.Value(message ? 1 : 0));
  const [reservedHeight, setReservedHeight] = useState(80);
  const reducedMotion = useReducedMotion();

  // Keep the most recent message as render state so clearing a prop cannot collapse the slot.
  if (message && (message !== content.message || isError !== content.isError)) {
    setContent({ message, isError });
  }

  useEffect(() => {
    opacity.stopAnimation();
    if (reducedMotion !== false) {
      opacity.setValue(message ? 1 : 0);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: message ? 1 : 0,
      duration: message ? motion.feedbackEnterDuration : motion.feedbackExitDuration,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [message, isError, opacity, reducedMotion]);

  return (
    <Animated.View
      testID="feedback-slot"
      style={{ minHeight: reservedHeight, opacity }}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        setReservedHeight((current) => Math.max(current, height));
      }}
      pointerEvents="none"
      aria-hidden={!message}
      accessibilityElementsHidden={!message}
      importantForAccessibility={message ? 'auto' : 'no-hide-descendants'}
    >
      <Text
        accessibilityRole={content.isError && message ? 'alert' : undefined}
        accessibilityLiveRegion={message ? 'polite' : 'none'}
        style={content.isError ? ui.error : ui.notice}
      >
        {t(content.message) || ' '}
      </Text>
    </Animated.View>
  );
}
