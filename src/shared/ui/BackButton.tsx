import { usePressMotion } from '../motion/usePressMotion';
import { useTranslation } from '../i18n/LanguageProvider';
import React from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function BackButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const press = usePressMotion(disabled);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Go back')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.35 : pressed ? 0.65 : 1 }]}
    >
      <Animated.View accessible={false} style={press.style}>
        <Animated.View style={styles.arrow} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  arrow: {
    width: 13,
    height: 13,
    borderLeftWidth: 2.2,
    borderBottomWidth: 2.2,
    borderColor: colors.accent,
    transform: [{ rotate: '45deg' }],
  },
});
