import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { TextField } from '../../../shared/ui/TextField';
import { Avatar } from '../../../shared/ui/Avatar';
import { colors } from '../../../shared/theme/colors';
import type { MapUserMarker } from '../models/map';
export function MapPeoplePicker({
  users,
  open,
  title,
  onClose,
  onSelect,
}: {
  users: readonly MapUserMarker[];
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  if (!open && search) setSearch('');
  const filtered = users.filter((user) =>
    user.nickname.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      transparent
      animationType={reducedMotion === false ? 'fade' : 'none'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        enabled={Platform.OS === 'ios'}
        behavior="padding"
        style={[styles.backdrop, { paddingBottom: Math.max(16, insets.bottom) }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Close')}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.card} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>
            {title ?? t('People here')} · {users.length}
          </Text>
          <TextField
            accessibilityLabel={t('Search people')}
            placeholder={t('Search people')}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {!filtered.length && <Text style={styles.name}>{t('No matching contacts.')}</Text>}
          <FlatList
            data={filtered}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 320, flexShrink: 1 }}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => onSelect(item.id)}
                style={styles.row}
              >
                <Avatar uri={item.avatarUrl} name={item.nickname} size={44} />
                <Text style={styles.name} numberOfLines={1}>
                  {item.nickname}
                </Text>
                <Text style={styles.arrow}>↗</Text>
              </Pressable>
            )}
          />
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
            <Text style={styles.arrow}>{t('Close')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxHeight: '75%',
    flexShrink: 1,
  },
  title: { color: colors.text, fontWeight: '700', fontSize: 20, marginBottom: 12 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.text, fontSize: 16, flex: 1 },
  arrow: { color: colors.accent, fontSize: 15 },
  close: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
