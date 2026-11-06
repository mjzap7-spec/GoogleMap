import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileState, ProfileViewModel } from '../viewmodels/ProfileViewModel';
import { ScreenLayout } from '../../../shared/ui/ScreenLayout';
import { FormField } from '../../../shared/ui/FormField';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
import { Feedback } from '../../../shared/ui/Feedback';
import { ui } from '../../../shared/ui/styles';
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
  passwordBusy?: boolean;
  editing?: boolean;
}) {
  const { t } = useTranslation();

  const [profileOpen, setProfileOpen] = useState(false);
  const disabled = state.busy || state.pickingAvatar || passwordBusy;
  return (
    <ScreenLayout
      onBack={onBack}
      backDisabled={backDisabled}
      title={editing ? t('Settings') : t('Your profile')}
    >
      <Text style={[ui.subtitle, styles.email]}>{email}</Text>
      {editing && settingsSection}
      <View style={editing ? styles.profileCard : undefined}>
        {editing && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: profileOpen }}
            onPress={() => setProfileOpen((value) => !value)}
            style={styles.sectionHeader}
          >
            <Text style={styles.sectionTitle}>{t('Edit profile')}</Text>
            <Text style={styles.sectionTitle}>{profileOpen ? '−' : '+'}</Text>
          </Pressable>
        )}
        {(!editing || profileOpen) && (
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
            <BirthdayField
              value={state.birthday}
              onChange={commands.setBirthday}
              disabled={disabled}
            />
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
                    <Text style={ui.muted}>
                      {[city.state, city.country].filter(Boolean).join(', ')}
                    </Text>
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
        )}
      </View>
      {passwordSection}
      {signOutSection}
    </ScreenLayout>
  );
}
const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    alignItems: 'center',
  },
  email: { marginBottom: 16 },
  profileCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: '#14161D',
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
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
