import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React from 'react';
import { AuthFormLayout } from './components/AuthFormLayout';
import { AuthFooter } from './components/AuthFooter';
import { CredentialsFields } from './components/CredentialsFields';
import { isFormBusy, type AuthViewProps } from './types';

export function SignUpView(props: AuthViewProps) {
  const { t } = useTranslation();

  return (
    <AuthFormLayout
      {...props}
      google
      title={t('Create account')}
      subtitle={t('Create an account to get started.')}
      submitLabel={t('Create account')}
      footer={
        <AuthFooter
          prompt={t('Already have an account?')}
          actionLabel={t('Sign in')}
          disabled={isFormBusy(props.state)}
          onPress={() => props.onNavigate('signin')}
        />
      }
    >
      <CredentialsFields state={props.state} commands={props.commands} includeConfirm />
    </AuthFormLayout>
  );
}
