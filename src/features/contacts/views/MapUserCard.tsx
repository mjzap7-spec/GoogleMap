import { Avatar } from '../../../shared/ui/Avatar';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
import type { ContactsPanelProps } from './ContactsPanel';
import type { ContactOverlayState } from '../viewmodels/contactSelectors';
import { ChatIcon } from '../../../shared/ui/ChatIcon';
import { UnreadBadge, chatButtonLabel } from '../../../shared/ui/UnreadBadge';
import { LocationUpdate } from './LocationUpdate';
export function MapUserCard({
  state,
  commands,
  unread,
  onChat,
}: Pick<ContactsPanelProps, 'commands'> & {
  state: Readonly<ContactOverlayState>;
  unread: number;
  onChat?: () => void;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const user = state.selectedUser;
  const contact = user && state.contacts.find((item) => item.peerId === user.id);
  const requested = user && state.requestedUserIds.includes(user.id);
  return (
    <Modal
      visible={!!user && !state.inboxOpen && !state.formOpen}
      transparent
      animationType={reduced === false ? 'fade' : 'none'}
      hardwareAccelerated
      onRequestClose={commands.closeMapUser}
    >
      <View style={[styles.backdrop, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={t('Close')}
          disabled={state.mapRequestBusy}
          onPress={commands.closeMapUser}
        />
        <View style={styles.card} accessibilityViewIsModal>
          <View accessible={false} style={styles.handle} />
          <View style={styles.heading}>
            <View>
              <Avatar
                uri={user?.avatarUrl}
                name={contact?.name || user?.nickname || ''}
                size={56}
              />
              <UnreadBadge count={unread} />
            </View>
            <View style={styles.identity}>
              <Text accessibilityRole="header" style={styles.name} numberOfLines={2}>
                {contact?.name || user?.nickname}
              </Text>
              {!!contact && <Text style={styles.muted}>{t('In your contacts')}</Text>}
              {!!requested && !contact && <Text style={styles.muted}>{t('Request sent')}</Text>}
            </View>
            {onChat && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={chatButtonLabel(
                  t,
                  t('Chat with {name}', { name: contact?.name || user?.nickname || '' }),
                  unread,
                )}
                onPress={onChat}
                disabled={state.mapRequestBusy}
                style={({ pressed }) => [styles.chat, pressed && { opacity: 0.6 }]}
              >
                <ChatIcon unread={unread} />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Close')}
              onPress={commands.closeMapUser}
              disabled={state.mapRequestBusy}
              style={({ pressed }) => [styles.close, pressed && { opacity: 0.5 }]}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {!!user && <LocationUpdate user={user} />}
          {state.loading && (
            <ActivityIndicator color={colors.accent} accessibilityLabel={t('Loading contacts')} />
          )}
          {!!(state.mapRequestError || state.loadError) && (
            <Text accessibilityRole="alert" style={styles.error}>
              {t(state.mapRequestError || state.loadError)}
            </Text>
          )}
          {!state.loading && !!state.loadError && (
            <Pressable accessibilityRole="button" onPress={commands.retry} style={styles.close}>
              <Text style={styles.muted}>{t('Retry')}</Text>
            </Pressable>
          )}
          {!contact && !requested && !state.loading && !state.loadError && (
            <PrimaryButton
              busy={state.mapRequestBusy}
              label={t('Send request')}
              onPress={commands.requestSelectedUser}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: colors.border,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    backgroundColor: '#0004',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 30,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 18,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  initial: { backgroundColor: '#BCB5FF18', alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 24, color: colors.accent, fontWeight: '600' },
  identity: { flex: 1, gap: 5 },
  name: { fontSize: 20, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chat: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BCB5FF14',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { color: colors.muted, fontSize: 28 },
  error: { color: '#ffb4be', fontSize: 14, lineHeight: 21 },
});
