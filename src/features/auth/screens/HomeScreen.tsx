import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { useMemo } from 'react';
import { Redirect, router } from 'expo-router';
import { PageSurface } from '../../../shared/motion/PageSurface';
import { usePageTransition } from '../../../shared/motion/usePageTransition';
import { HomeView } from '../views/HomeView';
import { useSession } from '../bindings/useSession';
import { SessionLoadingView } from '../views/SessionLoadingView';
import { useContacts } from '../../contacts/bindings/useContacts';
import { useMap } from '../../map/bindings/useMap';

/** Authentication and restoration are resolved by AuthNavigator before this page mounts. */
export function HomeScreen() {
  const { t } = useTranslation();

  const { state, retry } = useSession();
  const transition = usePageTransition();
  if (state.registrationProfilePending || state.profileRequired)
    return <Redirect href="/profile" />;
  if (state.user?.profileStatus === 'loading')
    return <SessionLoadingView message={t('Loading your profile...')} />;
  if (state.user?.profileStatus === 'error')
    return (
      <SessionLoadingView
        message={t('Your profile could not be loaded.')}
        error={state.error}
        onRetry={retry}
      />
    );
  return (
    <PageSurface transition={transition}>
      {state.user && <HomeContent key={state.user.id} error={state.error} />}
    </PageSurface>
  );
}

function HomeContent({ error }: { error: string }) {
  const map = useMap();
  const contacts = useContacts();
  const users = useMemo(() => {
    const result = [...contacts.state.nearby];
    if (contacts.state.focus && !result.some((item) => item.id === contacts.state.focus?.id))
      result.push(contacts.state.focus);
    return result.map((item) => ({
      ...item,
      nickname:
        contacts.state.contacts.find((contact) => contact.peerId === item.id)?.name ??
        item.nickname,
    }));
  }, [contacts.state.nearby, contacts.state.focus, contacts.state.contacts]);
  const focus = useMemo(
    () =>
      contacts.state.focus
        ? {
            ...(users.find((item) => item.id === contacts.state.focus?.id) ?? contacts.state.focus),
            revision: contacts.state.focus.revision,
          }
        : null,
    [users, contacts.state.focus],
  );
  return (
    <HomeView
      error={error}
      contacts={{
        ...contacts,
        onEdit: (contact) => router.push({ pathname: '/contact/[id]', params: { id: contact.id } }),
        onSelect: (contact) => {
          void contacts.commands.locateContact(contact);
        },
      }}
      map={{
        ...map,
        onSelectUser: contacts.commands.selectMapUser,
        users,
        focus,
      }}
    />
  );
}
