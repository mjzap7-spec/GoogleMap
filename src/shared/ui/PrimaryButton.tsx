import { useTranslation } from '../i18n/LanguageProvider';
import React, { useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePressMotion } from '../motion/usePressMotion';
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
  const press = usePressMotion(isDisabled);
  const [focused, setFocused] = useState(false);

  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(label)}
        accessibilityState={{ disabled: isDisabled, busy }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          ui.button,
          focused && s.focused,
          variant !== 'primary' && {
            backgroundColor: colors.input,
            borderWidth: 1,
            borderColor: colors.border,
          },
          { paddingHorizontal: 16, paddingVertical: 12 },
          { opacity: busy ? 0.85 : disabled ? 0.5 : pressed ? 0.9 : 1 },
        ]}
      >
        <View style={s.content}>
          <View style={s.iconSlot}>
            {busy ? (
              <ActivityIndicator
                size="small"
                color={variant === 'primary' ? colors.buttonText : colors.accent}
              />
            ) : (
              leadingIcon
            )}
          </View>
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
          <View style={s.iconSlot} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  focused: {
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineColor: colors.accent,
    outlineOffset: 3,
  },
  content: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconSlot: { width: 24, minHeight: 24, alignItems: 'center', justifyContent: 'center' },
});
