import { useTranslation } from '../i18n/LanguageProvider';
import React, { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, Text } from 'react-native';
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
  variant?: 'primary' | 'secondary';
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
    if (reducedMotion !== false) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue: value,
      duration: motion.buttonDuration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
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
          variant === 'secondary' && {
            backgroundColor: colors.input,
            borderWidth: 1,
            borderColor: colors.border,
          },
          leadingIcon
            ? { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 }
            : null,
          (isDisabled || pressed) && { opacity: 0.8 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={variant === 'secondary' ? colors.accent : colors.buttonText} />
        ) : (
          <>
            {leadingIcon}
            <Text
              style={[
                ui.buttonText,
                { flexShrink: 1, textAlign: 'center' },
                variant === 'secondary' && { color: colors.accent },
              ]}
            >
              {t(label)}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
