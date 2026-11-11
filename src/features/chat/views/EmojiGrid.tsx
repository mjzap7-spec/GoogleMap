import React, { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';

const key = (emoji: string) => emoji;
const rowLayout = (_: unknown, index: number) => ({ length: 44, offset: 44 * index, index });

/** Virtualize rows and keep unchanged emoji cells out of draft/selection renders. */
export const EmojiGrid = memo(function EmojiGrid({
  emojis,
  capacity,
  sending,
  onChoose,
}: {
  emojis: readonly string[];
  capacity: number;
  sending: boolean;
  onChoose: (emoji: string) => void;
}) {
  const [columns, setColumns] = useState(6);
  const choose = useRef(onChoose);
  useLayoutEffect(() => {
    choose.current = onChoose;
  }, [onChoose]);
  const select = useCallback((emoji: string) => choose.current(emoji), []);
  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <EmojiCell emoji={item} disabled={sending || item.length > capacity} onChoose={select} />
    ),
    [capacity, sending, select],
  );
  return (
    <View
      testID="emoji-grid"
      style={s.container}
      onLayout={({ nativeEvent }) =>
        setColumns(Math.max(4, Math.floor((nativeEvent.layout.width - 12) / 44)))
      }
    >
      <FlatList
        key={columns}
        data={emojis}
        keyExtractor={key}
        numColumns={columns}
        renderItem={renderItem}
        getItemLayout={rowLayout}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        columnWrapperStyle={s.row}
      />
    </View>
  );
});
const EmojiCell = memo(function EmojiCell({
  emoji,
  disabled,
  onChoose,
}: {
  emoji: string;
  disabled: boolean;
  onChoose: (emoji: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Insert {emoji}', { emoji })}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChoose(emoji)}
      style={({ pressed }) => [s.cell, disabled && s.disabled, pressed && s.pressed]}
    >
      <Text style={s.text}>{emoji}</Text>
    </Pressable>
  );
});
const s = StyleSheet.create({
  container: { height: 176 },
  content: { paddingHorizontal: 6 },
  row: { justifyContent: 'center' },
  cell: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 26 },
  disabled: { opacity: 0.45 },
  pressed: { backgroundColor: '#BCB5FF18' },
});
