import { useTranslation } from '../../../../shared/i18n/LanguageProvider';
import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import type { AvatarSelection } from '../../models/auth';
import { colors } from '../../../../shared/theme/colors';
import { ui } from '../../../../shared/ui/styles';
import { authStyles } from '../styles';

interface AvatarFieldProps {
  avatar: AvatarSelection | null;
  avatarUrl?: string | null;
  loading: boolean;
  disabled: boolean;
  onChoose: () => void;
  onRemove: () => void;
}

export function AvatarField({
  avatar,
  avatarUrl,
  loading,
  disabled,
  onChoose,
  onRemove,
}: AvatarFieldProps) {
  const { t } = useTranslation();

  const uri = avatar?.uri ?? avatarUrl;
  return (
    <View style={authStyles.avatarRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? t('Change avatar') : t('Choose avatar')}
        disabled={disabled}
        onPress={onChoose}
        style={authStyles.avatarCircle}
      >
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : uri ? (
          <Image source={{ uri }} style={authStyles.avatarImage} />
        ) : (
          <Text style={authStyles.avatarPlus}>+</Text>
        )}
      </Pressable>
      <View style={authStyles.avatarActions}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onChoose}
          style={authStyles.avatarAction}
        >
          <Text style={ui.link}>{uri ? t('Change photo') : t('Add a photo')}</Text>
        </Pressable>
        {uri ? (
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onRemove}
            style={authStyles.avatarAction}
          >
            <Text style={ui.muted}>{t('Remove photo')}</Text>
          </Pressable>
        ) : (
          <Text style={authStyles.avatarHint}>{t('Optional · JPG, PNG, WebP · up to 5 MB')}</Text>
        )}
      </View>
    </View>
  );
}
