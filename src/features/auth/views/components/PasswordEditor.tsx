import { useTranslation } from '../../../../shared/i18n/LanguageProvider';
import React, { useState } from 'react';
import { Text, View, StyleSheet, Pressable, Keyboard } from 'react-native';
import type { PasswordState, PasswordViewModel } from '../../viewmodels/PasswordViewModel';
import { FormField } from '../../../../shared/ui/FormField';
import { PrimaryButton } from '../../../../shared/ui/PrimaryButton';
import { Feedback } from '../../../../shared/ui/Feedback';
import { colors } from '../../../../shared/theme/colors';

export function PasswordEditor({
  state,
  setField,
  save,
  hasPassword,
  disabled,
}: {
  state: Readonly<PasswordState>;
  setField: PasswordViewModel['setField'];
  save: () => void;
  hasPassword: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {t('Security')}
      </Text>
      {hasPassword && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Change password')}
          accessibilityState={{ expanded, disabled: state.busy }}
          disabled={state.busy}
          onPress={() => {
            Keyboard.dismiss();
            setExpanded(!expanded);
          }}
          style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.65 }]}
        >
          <Text style={styles.toggleLabel}>{t('Change password')}</Text>
          <Text style={styles.chevron}>{expanded ? '−' : '+'}</Text>
        </Pressable>
      )}
      {hasPassword ? (
        expanded ? (
          <>
            <FormField
              label={t('Current password')}
              value={state.current}
              onChangeText={(value) => setField('current', value)}
              secureTextEntry
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!disabled && !state.busy}
            />
            <FormField
              label={t('New password')}
              placeholder={t('At least 8 characters')}
              value={state.password}
              onChangeText={(value) => setField('password', value)}
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!disabled && !state.busy}
            />
            <FormField
              label={t('Confirm new password')}
              value={state.confirm}
              onChangeText={(value) => setField('confirm', value)}
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!disabled && !state.busy}
            />
            <Feedback source="password" error={state.error} />
            <PrimaryButton
              label={t('Update password')}
              onPress={save}
              busy={state.busy}
              disabled={disabled || state.busy}
            />
          </>
        ) : null
      ) : (
        <Text style={styles.description}>
          {t('You sign in with Google. Manage your password in your Google Account.')}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: '#14161D',
    marginBottom: 12,
  },
  toggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  toggleLabel: { color: colors.text, fontSize: 15, fontWeight: '500' },
  chevron: { color: colors.accent, fontSize: 24 },
  title: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 12 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22 },
});
