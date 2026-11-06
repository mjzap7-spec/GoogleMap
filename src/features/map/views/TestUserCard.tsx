import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { Avatar } from '../../../shared/ui/Avatar';
import type { MapUserMarker } from '../models/map';
export function TestUserCard({ user, onClose }: { user?: MapUserMarker; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      visible={!!user}
      transparent
      animationType={reducedMotion === false ? 'fade' : 'none'}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Close')}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.card} accessibilityViewIsModal>
          <Avatar uri={null} name={user?.nickname ?? ''} size={52} />
          <Text accessibilityRole="header" style={styles.name}>
            {user?.nickname}
          </Text>
          <Text style={styles.hint}>{t('Simulated user')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={styles.link}>{t('Close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    backgroundColor: '#0005',
  },
  card: {
    backgroundColor: colors.input,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  name: { color: colors.text, fontSize: 20, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 13 },
  close: { minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  link: { color: colors.accent, fontWeight: '600' },
});
