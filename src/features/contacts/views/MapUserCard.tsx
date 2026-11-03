import { Avatar } from '../../../shared/ui/Avatar';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
import type { ContactsPanelProps } from './ContactsPanel';
export function MapUserCard({ state, commands }: Pick<ContactsPanelProps, 'state' | 'commands'>) {
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
          <View style={styles.heading}>
            <Avatar uri={user?.avatarUrl} name={contact?.name || user?.nickname || ''} size={56} />
            <View style={styles.identity}>
              <Text accessibilityRole="header" style={styles.name}>
                {contact?.name || user?.nickname}
              </Text>
              {!!contact && <Text style={styles.muted}>{t('In your contacts')}</Text>}
              {!!requested && !contact && <Text style={styles.muted}>{t('Request sent')}</Text>}
            </View>
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    backgroundColor: '#0006',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 24,
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
  closeText: { color: colors.muted, fontSize: 28 },
  error: { color: '#ffb4be', fontSize: 14, lineHeight: 21 },
});
