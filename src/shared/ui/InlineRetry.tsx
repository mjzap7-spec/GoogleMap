import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../i18n/LanguageProvider';
import { colors } from '../theme/colors';

/** A persistent load status belongs to its list, not to a floating action. */
export function InlineRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={s.card}>
      <View accessible={false} style={s.symbol}>
        <Text style={s.mark}>!</Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={s.message}>
        {t(message)}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [s.retry, pressed && { opacity: 0.6 }]}
      >
        <Text style={s.label}>{t('Retry')}</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DABF8733',
    backgroundColor: '#DABF8709',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    marginBottom: 12,
  },
  symbol: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderColor: '#DABF8780',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { color: '#DABF87', fontSize: 13, fontWeight: '700' },
  message: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  retry: {
    minWidth: 52,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  label: { color: colors.accent, fontWeight: '600', fontSize: 13 },
});
