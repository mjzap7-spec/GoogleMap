import { SharingProvider } from '../features/contacts/bindings/SharingProvider';
import { UnreadChatsProvider } from '../features/chat/bindings/UnreadChatsProvider';
import { ContactsProvider } from '../features/contacts/bindings/ContactsProvider';
import { ContactNotificationHost } from '../features/contacts/screens/ContactNotificationHost';
import React, { type PropsWithChildren } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { HelpIcon } from '../shared/ui/HelpIcon';
import { screenHelp } from '../features/help/models/helpTopics';
import { useTranslation } from '../shared/i18n/LanguageProvider';
import { router, usePathname, useGlobalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../features/auth/bindings/useSession';
import { MapToolbar } from '../features/map/screens/MapToolbar';
import { MapProvider } from '../features/map/bindings/MapProvider';
import { colors } from '../shared/theme/colors';

/** Persistent signed-in chrome sits outside the transitioning screen stack. */
export function AuthenticatedShell({ children }: PropsWithChildren) {
  const { state } = useSession();
  if (!state.user) return <ShellFrame>{children}</ShellFrame>;
  return (
    <MapProvider key={state.user.id}>
      <ContactsProvider user={state.user}>
        <SharingProvider user={state.user}>
          <UnreadChatsProvider uid={state.user.id}>
            <ShellFrame>
              {children}
              <ContactNotificationHost />
            </ShellFrame>
          </UnreadChatsProvider>
        </SharingProvider>
      </ContactsProvider>
    </MapProvider>
  );
}
function ShellFrame({ children }: PropsWithChildren) {
  const { state } = useSession();
  const pathname = usePathname();
  const { edit, section } = useGlobalSearchParams<{ edit?: string; section?: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigate = (path: '/' | '/contacts' | '/profile?edit=1' | '/help' | '/chat') => {
    Keyboard.dismiss();
    if (path === '/' && pathname === '/') return;
    if (path === '/contacts' && pathname === '/contacts') return;
    if (path === '/help' && pathname === '/help') return;
    if (path === '/chat' && pathname === '/chat') return;
    if (path === '/profile?edit=1' && pathname === '/profile' && edit === '1') return;
    router.navigate(path);
  };
  return (
    <View style={styles.shell}>
      <View style={styles.content}>{children}</View>
      {pathname !== '/help' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Help')}
          onPress={() => {
            Keyboard.dismiss();
            router.push({ pathname: '/help', params: { topic: screenHelp(pathname, section) } });
          }}
          style={({ pressed }) => [
            styles.help,
            { top: insets.top + 12, right: insets.right + 16, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <HelpIcon />
        </Pressable>
      )}
      {!!state.user && (
        <MapToolbar
          onMap={pathname === '/'}
          bottomInset={insets.bottom}
          onHome={() => navigate('/')}
          onSettings={() => navigate('/profile?edit=1')}
          onContacts={() => navigate('/contacts')}
          onChat={() => navigate('/chat')}
          activePage={
            pathname === '/chat' || pathname.startsWith('/chat/')
              ? 'chat'
              : pathname === '/profile'
                ? 'settings'
                : pathname === '/help'
                  ? 'help'
                  : pathname === '/contacts' || pathname.startsWith('/contact/')
                    ? 'contacts'
                    : 'home'
          }
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  help: {
    position: 'absolute',
    zIndex: 6,
    elevation: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
