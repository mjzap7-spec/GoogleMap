import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/ui/styles';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';

export function SessionLoadingView({
  message = 'Restoring your session...',
  error,
  onRetry,
}: {
  message?: string;
  error?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={ui.center}>
      <StatusBar style="light" />
      <Image
        source={require('../../../../assets/brand/google-maps.png')}
        style={{ width: 112, height: 112 }}
        resizeMode="contain"
        accessibilityLabel="Google Map"
      />
      {!error && <ActivityIndicator color={colors.accent} />}
      <Text style={ui.muted}>{t(message)}</Text>
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={[ui.muted, { textAlign: 'center', paddingHorizontal: 28 }]}
        >
          {t(error)}
        </Text>
      )}
      {onRetry && (
        <View style={{ width: 200 }}>
          <PrimaryButton label={t('Try again')} busy={false} onPress={onRetry} />
        </View>
      )}
    </View>
  );
}
