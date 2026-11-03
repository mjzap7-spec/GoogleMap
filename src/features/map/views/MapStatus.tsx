import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';

export function MapStatus({ error, retry }: { error?: string; retry?: () => void }) {
  const { t } = useTranslation();

  return (
    <View
      pointerEvents={error ? 'auto' : 'box-none'}
      style={[styles.overlay, !!error && styles.errorOverlay]}
    >
      <View pointerEvents={error ? 'auto' : 'none'} style={styles.card}>
        {error ? (
          <Text accessibilityRole="alert" style={styles.text}>
            {t(error)}
          </Text>
        ) : (
          <>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.text}>{t('Loading map…')}</Text>
          </>
        )}
        {retry && (
          <Pressable accessibilityRole="button" onPress={retry} style={styles.button}>
            <Text style={styles.action}>{t('Reload map')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: { backgroundColor: colors.background },
  card: {
    maxWidth: 320,
    padding: 20,
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  button: {
    minHeight: 46,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  action: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
