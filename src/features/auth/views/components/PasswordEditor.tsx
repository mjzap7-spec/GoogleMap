import { useTranslation } from '../../../../shared/i18n/LanguageProvider';
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import type { PasswordState, PasswordViewModel } from '../../viewmodels/PasswordViewModel';
import { FormField } from '../../../../shared/ui/FormField';
import { PrimaryButton } from '../../../../shared/ui/PrimaryButton';
import { Feedback } from '../../../../shared/ui/Feedback';
import { SettingsSection, SettingsSymbol } from '../../../../shared/ui/SettingsSection';
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

  return (
    <SettingsSection
      title={t('Security')}
      subtitle={hasPassword ? t('Change password') : t('Continue with Google')}
      label={hasPassword ? t('Change password') : t('Security')}
      icon={<SettingsSymbol kind="security" />}
      disabled={state.busy}
    >
      {hasPassword ? (
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
      ) : (
        <Text style={styles.description}>
          {t('You sign in with Google. Manage your password in your Google Account.')}
        </Text>
      )}
    </SettingsSection>
  );
}
const styles = StyleSheet.create({
  description: { color: colors.muted, fontSize: 13, lineHeight: 21 },
});
