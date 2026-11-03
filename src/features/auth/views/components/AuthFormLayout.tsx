import { useTranslation } from '../../../../shared/i18n/LanguageProvider';
import React, { type ReactNode, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../../shared/theme/colors';
import { ScreenLayout } from '../../../../shared/ui/ScreenLayout';
import { PrimaryButton } from '../../../../shared/ui/PrimaryButton';
import { EmailIcon, GoogleIcon } from '../../../../shared/ui/ButtonIcons';
import { Feedback } from '../../../../shared/ui/Feedback';
import { ui } from '../../../../shared/ui/styles';
import { authStyles } from '../styles';
import { isFormBusy, type AuthViewProps } from '../types';

interface AuthFormLayoutProps extends AuthViewProps {
  title: string;
  subtitle?: string;
  submitLabel: string;
  footer: ReactNode;
  google?: boolean;
}

export function AuthFormLayout({
  title,
  subtitle,
  submitLabel,
  footer,
  state,
  commands,
  isConfigured,
  sessionError,
  children,
  onBack,
  backDisabled,
  google = false,
}: PropsWithChildren<AuthFormLayoutProps>) {
  const { t } = useTranslation();

  return (
    <ScreenLayout onBack={onBack} backDisabled={backDisabled}>
      <Text accessibilityRole="header" style={ui.title}>
        {title}
      </Text>
      {!!subtitle && <Text style={ui.subtitle}>{subtitle}</Text>}
      <View style={authStyles.form}>{children}</View>
      <Feedback error={state.error || sessionError} notice={state.notice} />
      <PrimaryButton
        busy={state.busy && !state.googleBusy}
        disabled={isFormBusy(state)}
        onPress={commands.submit}
        label={submitLabel}
        leadingIcon={google ? <EmailIcon /> : undefined}
      />
      {google && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Continue with Google')}
          accessibilityState={{ disabled: isFormBusy(state), busy: state.googleBusy }}
          disabled={isFormBusy(state)}
          onPress={commands.continueWithGoogle}
          style={({ pressed }) => [
            styles.google,
            { opacity: pressed || isFormBusy(state) ? 0.6 : 1 },
          ]}
        >
          {state.googleBusy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.googleLabel}>{t('Continue with Google')}</Text>
          )}
          {!state.googleBusy && (
            <View pointerEvents="none" style={styles.googleIcon}>
              <GoogleIcon />
            </View>
          )}
        </Pressable>
      )}
      {footer}
      {!isConfigured && (
        <Text style={authStyles.setup}>{t('Authentication setup is pending.')}</Text>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  googleIcon: { position: 'absolute', left: 20, top: 0, bottom: 0, justifyContent: 'center' },
  google: {
    minHeight: 56,
    paddingHorizontal: 56,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  googleLabel: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
