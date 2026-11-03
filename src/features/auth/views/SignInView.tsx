import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { ui } from '../../../shared/ui/styles';
import { AuthFormLayout } from './components/AuthFormLayout';
import { AuthFooter } from './components/AuthFooter';
import { CredentialsFields } from './components/CredentialsFields';
import { authStyles } from './styles';
import { isFormBusy, type AuthViewProps } from './types';

export function SignInView(props: AuthViewProps) {
  const { t } = useTranslation();

  const disabled = isFormBusy(props.state);
  return (
    <AuthFormLayout
      {...props}
      google
      title={t('Sign in')}
      submitLabel={t('Sign in')}
      footer={
        <AuthFooter
          prompt={t('New here?')}
          actionLabel={t('Create an account')}
          disabled={disabled}
          onPress={() => props.onNavigate('signup')}
        />
      }
    >
      <CredentialsFields state={props.state} commands={props.commands} />
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={authStyles.forgot}
        onPress={() => props.onNavigate('reset')}
      >
        <Text style={ui.link}>{t('Forgot password?')}</Text>
      </Pressable>
    </AuthFormLayout>
  );
}
