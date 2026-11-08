import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileState, ProfileViewModel } from '../viewmodels/ProfileViewModel';
import { ScreenLayout } from '../../../shared/ui/ScreenLayout';
import { FormField } from '../../../shared/ui/FormField';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
import { Feedback } from '../../../shared/ui/Feedback';
import { ui } from '../../../shared/ui/styles';
import { Avatar } from '../../../shared/ui/Avatar';
import { SettingsSection } from '../../../shared/ui/SettingsSection';
import { colors } from '../../../shared/theme/colors';
import { AvatarField } from './components/AvatarField';
import { BirthdayField } from './components/BirthdayField';
import { CityAttribution } from './components/CityAttribution';

type Commands = Pick<
  ProfileViewModel,
  | 'setFullName'
  | 'setBirthday'
  | 'setCityQuery'
  | 'selectCity'
  | 'removeAvatar'
  | 'pickAvatar'
  | 'save'
>;
export function ProfileView({
  state,
  commands,
  email,
  sessionError,
  onBack,
  backDisabled,
  passwordSection,
  settingsSection,
  signOutSection,
  developerSection,
  passwordBusy = false,
  editing = false,
}: {
  state: Readonly<ProfileState>;
  commands: Commands;
  email: string | null;
  sessionError: string;
  onBack: () => void;
  backDisabled: boolean;
  passwordSection?: ReactNode;
  settingsSection?: ReactNode;
  signOutSection?: ReactNode;
  developerSection?: ReactNode;
  passwordBusy?: boolean;
  editing?: boolean;
}) {
  const { t } = useTranslation();

  const disabled = state.busy || state.pickingAvatar || passwordBusy;
  const profileForm = (
    <>
      <AvatarField
        avatar={state.avatar}
        avatarUrl={state.avatarUrl}
        loading={state.pickingAvatar}
        disabled={disabled}
        onChoose={commands.pickAvatar}
        onRemove={commands.removeAvatar}
      />
      <FormField
        label={t('Full name')}
        placeholder={t('Your full name')}
        value={state.fullName}
        onChangeText={commands.setFullName}
        autoComplete="name"
        autoCapitalize="words"
        maxLength={100}
        editable={!disabled}
      />
      <BirthdayField value={state.birthday} onChange={commands.setBirthday} disabled={disabled} />
      <FormField
        label={t('Location')}
        placeholder={t('Start typing your city')}
        value={state.cityQuery}
        onChangeText={commands.setCityQuery}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={120}
        editable={!disabled}
      />
      {state.searching && (
        <View style={styles.searching}>
          <ActivityIndicator color={colors.accent} />
          <Text style={ui.muted}>{t('Finding cities…')}</Text>
        </View>
      )}
      {!!state.suggestions.length && (
        <View style={styles.suggestions}>
          {state.suggestions.map((city) => (
            <Pressable
              key={city.id}
              accessibilityRole="button"
              accessibilityLabel={city.label}
              onPress={() => commands.selectCity(city)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.suggestion,
                pressed && { backgroundColor: colors.border },
              ]}
            >
              <Text style={styles.city}>{city.name}</Text>
              <Text style={ui.muted}>{[city.state, city.country].filter(Boolean).join(', ')}</Text>
            </Pressable>
          ))}
          <CityAttribution />
        </View>
      )}
      {state.searched && !state.suggestions.length && !state.locationError && (
        <Text style={styles.hint}>
          {t('No cities found. Try a nearby city or include the state or country.')}
        </Text>
      )}
      {!!state.locationError && (
        <Text accessibilityRole="alert" style={styles.hint}>
          {t(state.locationError)}
        </Text>
      )}
      <Feedback source="profile" error={state.error || sessionError} />
      <PrimaryButton
        busy={state.busy}
        disabled={disabled}
        onPress={commands.save}
        label={t('Save profile')}
      />
    </>
  );
  return (
    <ScreenLayout
      onBack={onBack}
      backDisabled={backDisabled}
      title={editing ? t('Settings') : t('Your profile')}
    >
      {editing ? (
        <SettingsSection
          title={state.fullName || t('Your profile')}
          subtitle={email ?? t('Edit profile')}
          label={t('Edit profile')}
          icon={<Avatar uri={state.avatarUrl} name={state.fullName} size={48} />}
          disabled={disabled}
        >
          {profileForm}
        </SettingsSection>
      ) : (
        <>
          <Text style={[ui.subtitle, styles.email]}>{email}</Text>
          {profileForm}
        </>
      )}
      {editing && settingsSection}
      {passwordSection}
      {developerSection}
      {signOutSection}
    </ScreenLayout>
  );
}
const styles = StyleSheet.create({
  email: { marginBottom: 16 },
  searching: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  suggestions: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: -12,
    marginBottom: 20,
  },
  suggestion: {
    padding: 14,
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.input,
    gap: 4,
  },
  city: { color: colors.text, fontSize: 16 },
  hint: { color: colors.muted, lineHeight: 21, marginBottom: 16 },
});
