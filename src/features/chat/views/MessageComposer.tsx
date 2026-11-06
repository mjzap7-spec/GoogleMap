import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { insertEmoji, MAX_MESSAGE_LENGTH, type DraftSelection } from '../models/messageDraft';

const emojis = [
  '😀',
  '😃',
  '😁',
  '😂',
  '🤣',
  '😊',
  '😉',
  '😍',
  '🥰',
  '😘',
  '😎',
  '🤔',
  '😅',
  '🤗',
  '😴',
  '😢',
  '😭',
  '😡',
  '👍',
  '👎',
  '👏',
  '🙌',
  '🙏',
  '💪',
  '👋',
  '❤️',
  '💔',
  '🔥',
  '✨',
  '🎉',
  '✅',
  '❌',
  '💯',
  '📍',
  '🗺️',
  '🚗',
  '🏠',
  '☕',
  '🎂',
  '🎁',
  '🥳',
  '🎶',
];

export function MessageComposer({
  draft,
  sending,
  groupRoom,
  onChangeText,
  onSend,
}: {
  draft: string;
  sending: boolean;
  groupRoom: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [selection, setSelection] = useState<DraftSelection>({
    start: draft.length,
    end: draft.length,
  });
  const [caret, setCaret] = useState<DraftSelection>();
  const [emojiOpen, setEmojiOpen] = useState(false);
  useEffect(() => {
    if (!emojiOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setEmojiOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [emojiOpen]);
  const chooseEmoji = (emoji: string) => {
    if (sending) return;
    const result = insertEmoji(draft, emoji, selection);
    if (!result) return;
    setSelection(result.selection);
    setCaret(result.selection);
    onChangeText(result.text);
  };
  return (
    <View style={s.container}>
      {emojiOpen && (
        <ScrollView
          style={s.palette}
          contentContainerStyle={s.emojis}
          keyboardShouldPersistTaps="always"
          accessibilityLabel={t('Emoji picker')}
        >
          {emojis.map((emoji) => {
            const disabled = sending || !insertEmoji(draft, emoji, selection);
            return (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={t('Insert {emoji}', { emoji })}
                disabled={disabled}
                accessibilityState={{ disabled }}
                onPress={() => chooseEmoji(emoji)}
                style={({ pressed }) => [s.emoji, pressed && s.pressed, disabled && s.dim]}
              >
                <Text style={s.emojiText}>{emoji}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <View style={s.composer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(emojiOpen ? 'Show keyboard' : 'Choose emoji')}
          accessibilityState={{ expanded: emojiOpen }}
          onPress={() => {
            if (emojiOpen) {
              setEmojiOpen(false);
              input.current?.focus();
            } else {
              input.current?.blur();
              Keyboard.dismiss();
              setEmojiOpen(true);
            }
          }}
          style={({ pressed }) => [s.emoji, emojiOpen && s.active, pressed && s.pressed]}
        >
          <View accessible={false} style={s.face}>
            <View style={s.eyes}>
              <View style={s.eye} />
              <View style={s.eye} />
            </View>
            <View style={s.smile} />
          </View>
        </Pressable>
        <TextInput
          ref={input}
          accessibilityLabel={t(groupRoom ? 'Message the group' : 'Private message')}
          placeholder={t(groupRoom ? 'Message the group' : 'Private message')}
          placeholderTextColor={colors.placeholder}
          keyboardAppearance="dark"
          selectionColor={colors.accent}
          maxLength={MAX_MESSAGE_LENGTH}
          multiline
          editable={!sending}
          value={draft}
          selection={caret}
          onFocus={() => setEmojiOpen(false)}
          onSelectionChange={(event) => {
            const next = event.nativeEvent.selection;
            setSelection((current) =>
              current.start === next.start && current.end === next.end ? current : next,
            );
            setCaret(undefined);
          }}
          onChangeText={onChangeText}
          style={s.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Send message')}
          accessibilityState={{ busy: sending, disabled: !draft.trim() || sending }}
          disabled={!draft.trim() || sending}
          onPress={onSend}
          style={({ pressed }) => [s.send, !draft.trim() && s.dim, pressed && s.pressed]}
        >
          {sending ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={s.arrow}>➤</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 8 },
  palette: { maxHeight: 192, backgroundColor: colors.input },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', padding: 6, justifyContent: 'center' },
  emoji: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 26 },
  active: { backgroundColor: '#BCB5FF18' },
  face: {
    width: 24,
    height: 24,
    borderWidth: 1.8,
    borderColor: colors.accent,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  eyes: { flexDirection: 'row', gap: 6 },
  eye: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  smile: {
    width: 11,
    height: 5,
    borderBottomWidth: 1.6,
    borderLeftWidth: 1.6,
    borderRightWidth: 1.6,
    borderColor: colors.accent,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 116,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 16,
  },
  send: {
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { color: colors.buttonText, fontSize: 23 },
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
