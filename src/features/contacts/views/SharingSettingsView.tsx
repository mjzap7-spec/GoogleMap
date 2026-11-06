import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import type { SharingState, SharingViewModel } from '../viewmodels/SharingViewModel';
import { changeSharingAudience } from '../models/sharing';
export function SharingSettingsView({
  state,
  onChange,
}: {
  state: Readonly<SharingState>;
  onChange: SharingViewModel['savePreferences'];
}) {
  const { t } = useTranslation();
  const disabled = !state.ready || state.busy;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('Location sharing')}</Text>
      <Text style={styles.description}>
        {t(
          state.action === 'preferences'
            ? 'Saving your sharing settings…'
            : 'Choose who can see your live location while the app is open.',
        )}
      </Text>
      {(['sharing', 'groups'] as const).map((key) => {
        const enabled =
          key === 'sharing'
            ? state.preferences.nearby || state.preferences.groups
            : state.preferences.groups;
        const label = t(key === 'sharing' ? 'Share my location' : 'Share with private groups');
        const description = t(
          key === 'sharing'
            ? 'Share your live GPS while the app is open.'
            : 'On shares only with group members. Off shares with nearby users within 1 km.',
        );
        const change = (value: boolean) =>
          onChange(changeSharingAudience(state.preferences, key, value));
        return (
          <View key={key} style={styles.row}>
            <Pressable
              style={styles.copy}
              accessible={false}
              focusable={false}
              tabIndex={-1}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              disabled={disabled}
              onPress={() => change(!enabled)}
            >
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.description}>{description}</Text>
            </Pressable>
            <Switch
              accessibilityLabel={label}
              accessibilityHint={description}
              disabled={disabled}
              value={enabled}
              onValueChange={change}
              thumbColor={enabled ? colors.accent : colors.muted}
              trackColor={{ false: colors.border, true: '#675E9A' }}
            />
          </View>
        );
      })}
      {!!state.tripGroupId && (
        <Text style={styles.description}>
          {t('Your active trip is shared separately. Stop it in Private groups.')}
        </Text>
      )}
      {!!state.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('Could not update sharing. Try again.')}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    marginBottom: 12,
    gap: 8,
  },
  title: { color: colors.text, fontSize: 19, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  copy: { flex: 1, gap: 5, minHeight: 44, justifyContent: 'center' },
  label: { color: colors.text, fontWeight: '600', fontSize: 14 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  error: { color: '#ffb4be', lineHeight: 20 },
});
