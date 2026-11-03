import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React from 'react';
import { FormField } from '../../../shared/ui/FormField';
import { AuthFormLayout } from './components/AuthFormLayout';
import { AuthFooter } from './components/AuthFooter';
import { isFormBusy, type AuthViewProps } from './types';

export function ResetPasswordView(props: AuthViewProps) {
  const { t } = useTranslation();

  const disabled = isFormBusy(props.state);
  return (
    <AuthFormLayout
      {...props}
      title={t('Reset password')}
      subtitle={t('We will email you a password reset link.')}
      submitLabel={t('Send reset link')}
      footer={
        <AuthFooter
          prompt={t('Remember your password?')}
          actionLabel={t('Sign in')}
          disabled={disabled}
          onPress={() => props.onNavigate('signin')}
        />
      }
    >
      <FormField
        label={t('Email address')}
        placeholder="you@example.com"
        value={props.state.email}
        onChangeText={props.commands.setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        editable={!disabled}
      />
    </AuthFormLayout>
  );
}
