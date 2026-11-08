import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
import { ChatActionRow, ChatSheet } from './ChatSheet';
export function ChatHistorySheet({
  mode,
  busy,
  error,
  onClose,
  onSelect,
  onClear,
  onConfirm,
}: {
  mode: 'options' | 'clear';
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSelect: () => void;
  onClear: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ChatSheet
      title={t(mode === 'options' ? 'Chat options' : 'Clear chat?')}
      busy={busy}
      error={error}
      onClose={onClose}
    >
      {(dismiss) =>
        mode === 'options' ? (
          <>
            <ChatActionRow
              kind="select"
              label={t('Select messages')}
              onPress={() => dismiss(onSelect)}
            />
            <ChatActionRow kind="delete" label={t('Clear chat on this device')} onPress={onClear} />
          </>
        ) : (
          <View style={s.content}>
            <Text style={s.description}>
              {t(
                'Clear the existing history on this device. New messages will still appear. Other participants keep their messages.',
              )}
            </Text>
            <PrimaryButton busy={busy} label={t('Clear for me')} onPress={onConfirm} />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => dismiss()}
              style={s.cancel}
            >
              <Text style={s.label}>{t('Cancel')}</Text>
            </Pressable>
          </View>
        )
      }
    </ChatSheet>
  );
}
const s = StyleSheet.create({
  content: { paddingHorizontal: 8 },
  description: { fontSize: 14, lineHeight: 22, color: colors.muted, marginBottom: 20 },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
