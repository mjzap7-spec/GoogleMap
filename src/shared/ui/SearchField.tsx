import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { useTranslation } from '../i18n/LanguageProvider';
import { colors } from '../theme/colors';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
};

/** Search controls share spacing and a clear action that keeps the keyboard open. */
export function SearchField({ value, onChangeText, style, onFocus, onBlur, ...props }: Props) {
  const { t } = useTranslation();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.container, focused && s.focused]}>
      <Pressable
        accessible={false}
        disabled={props.editable === false}
        onPress={() => input.current?.focus()}
        style={s.iconSlot}
      >
        <View pointerEvents="none" style={s.icon}>
          <View style={s.handle} />
        </View>
      </Pressable>
      <TextInput
        ref={input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        {...props}
        placeholder={props.placeholder ? t(props.placeholder) : undefined}
        accessibilityLabel={props.accessibilityLabel ? t(props.accessibilityLabel) : undefined}
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.accent}
        keyboardAppearance="dark"
        underlineColorAndroid="transparent"
        value={value}
        onChangeText={onChangeText}
        style={[s.input, style]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      <View style={s.clearSlot}>
        {!!value && props.editable !== false && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Clear search')}
            onPress={() => {
              onChangeText('');
              input.current?.focus();
            }}
            style={({ pressed }) => [s.clear, pressed && s.pressed]}
          >
            <View accessible={false} style={s.cross} />
            <View accessible={false} style={[s.cross, s.crossBack]} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  // Native input padding can change when Android applies focus decoration. Keep
  // icon space outside the input so focus/selection can never overlap it.
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  focused: { borderColor: colors.accent, backgroundColor: '#1E1F2C' },
  iconSlot: {
    width: 42,
    minHeight: 46,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSlot: { width: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingHorizontal: 0,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: 'transparent',
    borderWidth: 0,
    outlineWidth: 0,
  },
  icon: {
    width: 13,
    height: 13,
    borderWidth: 1.7,
    borderColor: colors.muted,
    borderRadius: 7,
  },
  handle: {
    position: 'absolute',
    width: 6,
    height: 1.7,
    right: -5,
    bottom: -2,
    backgroundColor: colors.muted,
    transform: [{ rotate: '45deg' }],
  },
  clear: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cross: {
    position: 'absolute',
    width: 13,
    height: 1.7,
    borderRadius: 1,
    backgroundColor: colors.muted,
    transform: [{ rotate: '45deg' }],
  },
  crossBack: { transform: [{ rotate: '-45deg' }] },
  pressed: { backgroundColor: '#BCB5FF14' },
});
