import { useTranslation } from '../../../../shared/i18n/LanguageProvider';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormField } from '../../../../shared/ui/FormField';
import { TextField } from '../../../../shared/ui/TextField';
import { ui } from '../../../../shared/ui/styles';
import { authStyles } from '../styles';
import { isFormBusy, type AuthViewProps } from '../types';

interface CredentialsFieldsProps extends Pick<AuthViewProps, 'state' | 'commands'> {
  includeConfirm?: boolean;
}

export function CredentialsFields({
  state,
  commands,
  includeConfirm = false,
}: CredentialsFieldsProps) {
  const { t } = useTranslation();

  const disabled = isFormBusy(state);
  return (
    <>
      <FormField
        label={t('Email address')}
        placeholder="you@example.com"
        value={state.email}
        onChangeText={commands.setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        editable={!disabled}
      />
      <Text style={ui.label}>{t('Password')}</Text>
      <View style={authStyles.passwordRow}>
        <TextField
          accessibilityLabel={t('Password')}
          style={{ paddingRight: 70 }}
          placeholder={includeConfirm ? t('At least 8 characters') : t('Enter your password')}
          value={state.password}
          onChangeText={commands.setPassword}
          secureTextEntry={!state.show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={includeConfirm ? 'new-password' : 'current-password'}
          editable={!disabled}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={state.show ? t('Hide password') : t('Show password')}
          disabled={disabled}
          onPress={commands.togglePassword}
          style={authStyles.show}
        >
          <Text style={ui.link}>{state.show ? t('Hide') : t('Show')}</Text>
        </Pressable>
      </View>
      {includeConfirm && (
        <FormField
          label={t('Confirm password')}
          placeholder={t('Enter your password again')}
          value={state.confirm}
          onChangeText={commands.setConfirm}
          secureTextEntry={!state.show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          editable={!disabled}
        />
      )}
    </>
  );
}
