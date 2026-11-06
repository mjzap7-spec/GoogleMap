import { useTranslation } from '../../../../shared/i18n/LanguageProvider';
import React, { useRef, useState } from 'react';
import { Pressable, Text, View, type TextInput } from 'react-native';
import { FormField } from '../../../../shared/ui/FormField';
import { TextField } from '../../../../shared/ui/TextField';
import { ui } from '../../../../shared/ui/styles';
import { authStyles } from '../styles';
import { isFormBusy, type AuthViewProps } from '../types';

interface CredentialsFieldsProps extends Pick<AuthViewProps, 'state' | 'commands'> {
  includeConfirm?: boolean;
  onForgotPassword?: () => void;
}

export function CredentialsFields({
  state,
  commands,
  includeConfirm = false,
  onForgotPassword,
}: CredentialsFieldsProps) {
  const { t } = useTranslation();
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <View style={authStyles.passwordHeading}>
        <Text style={[ui.label, { marginBottom: 0 }]}>{t('Password')}</Text>
        {onForgotPassword && (
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onForgotPassword}
            style={authStyles.forgot}
          >
            <Text style={ui.link}>{t('Forgot password?')}</Text>
          </Pressable>
        )}
      </View>
      <View style={[authStyles.passwordRow, passwordFocused && ui.inputFocused]}>
        <TextField
          ref={passwordRef}
          accessibilityLabel={t('Password')}
          style={authStyles.passwordInput}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          returnKeyType={includeConfirm ? 'next' : 'done'}
          submitBehavior={includeConfirm ? 'submit' : 'blurAndSubmit'}
          onSubmitEditing={includeConfirm ? () => confirmRef.current?.focus() : commands.submit}
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
          ref={confirmRef}
          returnKeyType="done"
          onSubmitEditing={commands.submit}
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
