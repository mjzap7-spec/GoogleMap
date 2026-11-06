import { useTranslation } from '../../../../shared/i18n/LanguageProvider';
import React, { type ReactNode, type PropsWithChildren } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
    <ScreenLayout
      onBack={onBack}
      backDisabled={backDisabled}
      header={
        google && (
          <View style={styles.brand}>
            <Image
              accessible={false}
              source={require('../../../../../assets/brand/google-maps.png')}
              resizeMode="contain"
              style={styles.brandIcon}
            />
            <Text style={styles.brandText}>Google Map</Text>
          </View>
        )
      }
      footer={google ? <View style={styles.footer}>{footer}</View> : undefined}
    >
      <Text accessibilityRole="header" style={[ui.title, google && styles.heading]}>
        {title}
      </Text>
      {!!subtitle && <Text style={ui.subtitle}>{subtitle}</Text>}
      <View style={authStyles.form}>{children}</View>
      <Feedback source="auth-form" error={state.error || sessionError} />
      <PrimaryButton
        busy={state.busy && !state.googleBusy}
        disabled={isFormBusy(state)}
        onPress={commands.submit}
        label={submitLabel}
        leadingIcon={google ? <EmailIcon /> : undefined}
      />
      {google && (
        <>
          <View style={styles.divider}>
            <View style={styles.rule} />
            <Text style={styles.dividerText}>{t('or')}</Text>
            <View style={styles.rule} />
          </View>
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
              <>
                <GoogleIcon />
                <Text style={styles.googleLabel}>{t('Continue with Google')}</Text>
              </>
            )}
          </Pressable>
        </>
      )}
      {!google && footer}
      {!isConfigured && (
        <Text style={authStyles.setup}>{t('Authentication setup is pending.')}</Text>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  brand: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: { width: 26, height: 26 },
  brandText: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  heading: { fontSize: 34, lineHeight: 42, letterSpacing: -1, fontWeight: '700', marginBottom: 0 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { fontSize: 13, color: colors.muted },
  footer: {
    width: '100%',
    maxWidth: 380,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 6,
  },
  google: {
    minHeight: 52,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleLabel: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
