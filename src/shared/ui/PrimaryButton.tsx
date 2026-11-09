import { useTranslation } from '../i18n/LanguageProvider';
import React, { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useReducedMotion } from '../motion/useReducedMotion';
import { motion } from '../motion/tokens';
import { colors } from '../theme/colors';
import { ui } from './styles';

interface PrimaryButtonProps {
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
  label: string;
  leadingIcon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'neutral';
}

export function PrimaryButton({
  busy,
  disabled = false,
  onPress,
  label,
  leadingIcon,
  variant = 'primary',
}: PrimaryButtonProps) {
  const { t } = useTranslation();
  const isDisabled = busy || disabled;
  const [scale] = useState(() => new Animated.Value(1));
  const reducedMotion = useReducedMotion();

  function animatePress(value: number) {
    scale.stopAnimation();
    if (reducedMotion !== false) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: value,
      duration: motion.buttonDuration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    }).start();
  }

  useEffect(() => {
    if (isDisabled || reducedMotion) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => scale.stopAnimation();
  }, [isDisabled, reducedMotion, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(label)}
        accessibilityState={{ disabled: isDisabled, busy }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => animatePress(motion.buttonPressedScale)}
        onPressOut={() => animatePress(1)}
        style={({ pressed }) => [
          ui.button,
          variant !== 'primary' && {
            backgroundColor: colors.input,
            borderWidth: 1,
            borderColor: colors.border,
          },
          { paddingHorizontal: 16, paddingVertical: 12 },
          { opacity: busy ? 0.85 : disabled ? 0.5 : pressed ? 0.9 : 1 },
        ]}
      >
        <View
          accessibilityElementsHidden={busy}
          importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'}
          style={[s.content, busy && { opacity: 0 }]}
        >
          {leadingIcon}
          <Text
            style={[
              ui.buttonText,
              { flexShrink: 1, textAlign: 'center' },
              variant === 'secondary' && { color: colors.accent },
              variant === 'neutral' && { color: colors.text },
            ]}
          >
            {t(label)}
          </Text>
        </View>
        {busy && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.loading]}>
            <ActivityIndicator color={variant === 'primary' ? colors.buttonText : colors.accent} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  content: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  loading: { alignItems: 'center', justifyContent: 'center' },
});
