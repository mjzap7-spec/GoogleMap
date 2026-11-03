import { ContactsProvider } from '../features/contacts/bindings/ContactsProvider';
import { ContactNotificationHost } from '../features/contacts/screens/ContactNotificationHost';
import React, { type PropsWithChildren } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
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
        <ShellFrame>
          {children}
          <ContactNotificationHost />
        </ShellFrame>
      </ContactsProvider>
    </MapProvider>
  );
}
function ShellFrame({ children }: PropsWithChildren) {
  const { state } = useSession();
  const pathname = usePathname();
  const { edit } = useGlobalSearchParams<{ edit?: string }>();
  const insets = useSafeAreaInsets();
  const navigate = (path: '/' | '/contacts' | '/profile?edit=1' | '/help') => {
    Keyboard.dismiss();
    if (path === '/' && pathname === '/') return;
    if (path === '/contacts' && pathname === '/contacts') return;
    if (path === '/help' && pathname === '/help') return;
    if (path === '/profile?edit=1' && pathname === '/profile' && edit === '1') return;
    router.navigate(path);
  };
  return (
    <View style={styles.shell}>
      <View style={styles.content}>{children}</View>
      {!!state.user && (
        <MapToolbar
          onMap={pathname === '/'}
          bottomInset={insets.bottom}
          onHome={() => navigate('/')}
          onSettings={() => navigate('/profile?edit=1')}
          onContacts={() => navigate('/contacts')}
          onHelp={() => navigate('/help')}
          activePage={
            pathname === '/profile'
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
});
