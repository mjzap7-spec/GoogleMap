import { useTranslation } from '../i18n/LanguageProvider';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function BackButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Go back')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.35 : pressed ? 0.65 : 1 }]}
    >
      <View accessible={false} style={styles.arrow} />
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
