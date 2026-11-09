import { DeveloperTesting } from '../../map/screens/DeveloperTesting';
import { SharingSettings } from '../../contacts/screens/SharingSettings';
import { SettingsSignOut } from '../../../shared/ui/SettingsSection';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { useMapSettings } from '../../map/bindings/useMapSettings';
import { MapLanguageSettings } from '../../map/views/MapLanguageSettings';
import React, { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '../bindings/useSession';
import { PageSurface } from '../../../shared/motion/PageSurface';
import { usePageTransition } from '../../../shared/motion/usePageTransition';
import { ProfileView } from '../views/ProfileView';
import { useProfile } from '../bindings/useProfile';
import type { AuthUser } from '../models/auth';
import { usePassword } from '../bindings/usePassword';
import { PasswordEditor } from '../views/components/PasswordEditor';
import { SessionLoadingView } from '../views/SessionLoadingView';

export function ProfileScreen() {
  const { t } = useTranslation();

  const { state, acknowledgeRegistrationLanding, retry } = useSession();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  useEffect(() => {
    if (state.user) acknowledgeRegistrationLanding();
  }, [state.user, acknowledgeRegistrationLanding]);
  if (!state.user) return null;
  if (edit === '1' && state.user.profileStatus === 'loading')
    return <SessionLoadingView message={t('Loading your profile...')} />;
  if (edit === '1' && state.user.profileStatus === 'error')
    return (
      <SessionLoadingView
        message={t('Your profile could not be loaded.')}
        error={state.error}
        onRetry={retry}
      />
    );
  return <ProfileEditor key={state.user.id} user={state.user} sessionError={state.error} />;
}

function ProfileEditor({ user, sessionError }: { user: AuthUser; sessionError: string }) {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const { state: session, logout } = useSession();
  const { t } = useTranslation();
  const password = usePassword(user.id);
  const mapSettings = useMapSettings();
  const { state, commands } = useProfile(user);
  const transition = usePageTransition();
  const { navigate } = transition;
  useEffect(() => {
    if (state.saveComplete) navigate(() => router.replace('/'));
  }, [state.saveComplete, navigate]);
  return (
    <PageSurface transition={transition}>
      <ProfileView
        state={state}
        commands={commands}
        email={user.email}
        sessionError={sessionError || mapSettings.error}
        backDisabled={false}
        editing={editing}
        passwordBusy={password.state.busy}
        signOutSection={
          editing ? (
            <SettingsSignOut
              label={t('Sign out')}
              onPress={logout}
              busy={session.busy}
              disabled={state.busy || password.state.busy}
            />
          ) : undefined
        }
        settingsSection={
          editing ? (
            <>
              <SharingSettings />
              <MapLanguageSettings
                language={mapSettings.language}
                onChange={mapSettings.setLanguage}
              />
            </>
          ) : undefined
        }
        developerSection={editing ? <DeveloperTesting /> : undefined}
        passwordSection={
          editing ? (
            <PasswordEditor
              {...password}
              hasPassword={!!user.hasPassword}
              disabled={state.busy || state.pickingAvatar}
            />
          ) : undefined
        }
        onBack={() =>
          transition.navigate(() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          })
        }
      />
    </PageSurface>
  );
}
