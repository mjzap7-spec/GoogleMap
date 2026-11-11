import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { insertEmoji, MAX_MESSAGE_LENGTH, type DraftSelection } from '../models/messageDraft';
import { useChatPress, useChatProgress, useMessageArrival } from './chatMotion';
import { EmojiPicker } from './EmojiPicker';

export function MessageComposer({
  height,
  onHeightChange,
  draft,
  sending,
  groupRoom,
  onChangeText,
  onSend,
  context,
  actionKey,
  editing = false,
  onCancelAction,
}: {
  height: number;
  onHeightChange: (height: number) => void;
  draft: string;
  sending: boolean;
  groupRoom: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
  context?: { label: string; text: string };
  actionKey?: string;
  editing?: boolean;
  onCancelAction: () => void;
}) {
  const { t } = useTranslation();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [selection, setSelection] = useState<DraftSelection>({
    start: draft.length,
    end: draft.length,
  });
  const [caret, setCaret] = useState<DraftSelection>();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const sendOpacity = useChatProgress(draft.trim() || sending ? 1 : 0.4, 120);
  const sendPress = useChatPress();
  const emojiPress = useChatPress();
  const appearance = useMessageArrival(true);
  useEffect(() => {
    if (!actionKey) return;
    // Reply/edit now use the inline action bar. Focus as soon as the composer mounts.
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [actionKey]);
  useEffect(() => {
    if (!emojiOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setEmojiOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [emojiOpen]);
  const closeEmoji = useCallback(() => setEmojiOpen(false), []);
  const chooseEmoji = useCallback(
    (emoji: string) => {
      if (sending) return;
      const result = insertEmoji(draft, emoji, selection);
      if (!result) return;
      setSelection(result.selection);
      setCaret(result.selection);
      onChangeText(result.text);
    },
    [draft, selection, sending, onChangeText],
  );
  return (
    <Animated.View pointerEvents="box-none" style={[s.container, appearance]}>
      <EmojiPicker
        open={emojiOpen}
        bottom={height + 8}
        draft={draft}
        selection={selection}
        sending={sending}
        onChoose={chooseEmoji}
        onClose={closeEmoji}
      />
      <View
        style={s.composer}
        onLayout={(event) => onHeightChange(Math.ceil(event.nativeEvent.layout.height))}
      >
        {context && (
          <View style={s.context}>
            <View style={s.contextText}>
              <Text numberOfLines={1} style={s.contextLabel}>
                {context.label}
              </Text>
              <Text numberOfLines={1} style={s.contextPreview}>
                {context.text}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(editing ? 'Cancel editing' : 'Cancel reply')}
              disabled={sending}
              onPress={onCancelAction}
              style={s.emoji}
            >
              <Text style={s.cancel}>×</Text>
            </Pressable>
          </View>
        )}
        <View style={s.inputRow}>
          <View style={[s.field, (focused || emojiOpen) && s.focused]}>
            <Animated.View style={emojiPress.style}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(emojiOpen ? 'Show keyboard' : 'Choose emoji')}
                accessibilityState={{ expanded: emojiOpen }}
                onPressIn={emojiPress.onPressIn}
                onPressOut={emojiPress.onPressOut}
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
            </Animated.View>
            <TextInput
              ref={input}
              accessibilityLabel={t(groupRoom ? 'Message the group' : 'Private message')}
              placeholder={t('Message')}
              placeholderTextColor={colors.placeholder}
              keyboardAppearance="dark"
              selectionColor={colors.accent}
              underlineColorAndroid="transparent"
              maxLength={MAX_MESSAGE_LENGTH}
              multiline
              editable={!sending}
              value={draft}
              selection={caret}
              onFocus={() => {
                setFocused(true);
                setEmojiOpen(false);
              }}
              onBlur={() => setFocused(false)}
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
          </View>
          <Animated.View style={[sendPress.style, { opacity: sendOpacity }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(editing ? 'Save changes' : 'Send message')}
              accessibilityState={{ busy: sending, disabled: !draft.trim() || sending }}
              disabled={!draft.trim() || sending}
              onPress={onSend}
              onPressIn={sendPress.onPressIn}
              onPressOut={sendPress.onPressOut}
              style={s.send}
            >
              {sending ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : editing ? (
                <Text style={s.save}>✓</Text>
              ) : (
                <View accessible={false} style={s.sendIcon}>
                  <View style={s.plane} />
                  <View style={s.planeFold} />
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  composer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#12141B',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF09',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderColor: colors.accent,
    paddingLeft: 10,
  },
  contextText: { flex: 1, gap: 3 },
  contextLabel: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  contextPreview: { color: colors.muted, fontSize: 13 },
  cancel: { color: colors.muted, fontSize: 26 },
  save: { color: colors.buttonText, fontSize: 24, fontWeight: '600' },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    backgroundColor: '#1C1F29',
    borderWidth: 1,
    borderColor: '#343846',
    paddingVertical: 1,
  },
  focused: { borderColor: '#BCB5FF65' },
  emoji: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    minWidth: 0,
    minHeight: 44,
    maxHeight: 116,
    paddingLeft: 2,
    paddingRight: 12,
    paddingTop: 11,
    paddingBottom: 11,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  send: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { width: 24, height: 24, transform: [{ rotate: '-28deg' }] },
  plane: {
    position: 'absolute',
    width: 0,
    height: 0,
    left: 1,
    top: 3,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 22,
    borderColor: 'transparent',
    borderLeftColor: colors.buttonText,
  },
  planeFold: {
    position: 'absolute',
    width: 0,
    height: 0,
    left: 0,
    top: 9,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderLeftWidth: 12,
    borderColor: 'transparent',
    borderLeftColor: colors.accent,
  },
  pressed: { opacity: 0.65 },
});
