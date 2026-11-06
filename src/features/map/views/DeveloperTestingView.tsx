import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import type { TestUserCount } from '../models/testUsers';
export function DeveloperTestingView({
  count,
  hasLocation,
  onChange,
  onViewMap,
}: {
  count: TestUserCount;
  hasLocation: boolean;
  onChange: (count: TestUserCount) => void;
  onViewMap: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('Developer testing')}</Text>
      <Text style={styles.hint}>
        {t(
          'Simulated people replace real map users on this device. No test accounts or requests are created.',
        )}
      </Text>
      <View style={styles.row}>
        <Text style={styles.label}>{t('Show test users')}</Text>
        <Switch
          accessibilityLabel={t('Show test users')}
          value={count > 0}
          onValueChange={(enabled) => onChange(enabled ? 10 : 0)}
          thumbColor={colors.accent}
          trackColor={{ false: colors.border, true: '#675E9A' }}
        />
      </View>
      <View style={styles.options}>
        {([10, 100, 500] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={t('{count} test users', { count: value })}
            accessibilityState={{ selected: count === value, disabled: !count }}
            disabled={!count}
            onPress={() => onChange(value)}
            style={[styles.option, count === value && styles.selected, !count && { opacity: 0.5 }]}
          >
            <Text style={styles.label}>{value}</Text>
          </Pressable>
        ))}
      </View>
      {!!count && !hasLocation && (
        <Text style={styles.hint}>
          {t('Test users appear after your GPS location is available.')}
        </Text>
      )}
      {!!count && (
        <Pressable accessibilityRole="button" onPress={onViewMap} style={styles.open}>
          <Text style={styles.link}>{t('View test map')}</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    marginBottom: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  options: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: colors.accent, backgroundColor: '#BCB5FF18' },
  open: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  link: { color: colors.accent, fontWeight: '600' },
});
