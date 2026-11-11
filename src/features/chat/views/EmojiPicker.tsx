import React, { memo, useCallback, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { usePresenceMotion } from '../../../shared/motion/usePresenceMotion';
import { colors } from '../../../shared/theme/colors';
import { emojiInsertionCapacity, type DraftSelection } from '../models/messageDraft';
import { emojiPickerCategories } from '../models/emojiCatalog';
import { EmojiGrid } from './EmojiGrid';
import { AnimatedEmoji } from './AnimatedEmoji';

/** No emoji grid is built while typing with the picker closed. */
export const EmojiPicker = memo(function EmojiPicker({
  open,
  bottom,
  draft,
  selection,
  sending,
  onChoose,
  onClose,
}: {
  open: boolean;
  bottom: number;
  draft: string;
  selection: DraftSelection;
  sending: boolean;
  onChoose: (emoji: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { mounted, progress } = usePresenceMotion(open);
  const [categoryId, setCategoryId] = useState<string>(emojiPickerCategories[0].id);
  const [preview, setPreview] = useState({ emoji: '❤️', replay: 0 });
  const choose = useCallback(
    (emoji: string) => {
      onChoose(emoji);
      setPreview((previous) => ({ emoji, replay: previous.replay + 1 }));
    },
    [onChoose],
  );
  const category =
    emojiPickerCategories.find((item) => item.id === categoryId) ?? emojiPickerCategories[0];
  if (!mounted) return null;
  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!open}
      style={[
        s.card,
        {
          bottom,
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      <View style={s.header}>
        <Text accessibilityRole="header" style={s.title}>
          {t(category.label)}
        </Text>
        {category.id === 'animated' && (
          <AnimatedEmoji
            emoji={preview.emoji}
            replay={preview.replay}
            autoplay={open}
            disabled={!open}
            size={24}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Close')}
          onPress={onClose}
          style={({ pressed }) => [s.close, pressed && s.pressed]}
        >
          <Text accessible={false} style={s.closeText}>
            ×
          </Text>
        </Pressable>
      </View>
      <EmojiGrid
        key={category.id}
        emojis={category.emojis}
        capacity={emojiInsertionCapacity(draft, selection)}
        sending={sending}
        onChoose={choose}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        style={s.categories}
        contentContainerStyle={s.categoryList}
      >
        {emojiPickerCategories.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={t(item.label)}
            accessibilityState={{ selected: category.id === item.id }}
            aria-selected={category.id === item.id}
            onPress={() => setCategoryId(item.id)}
            style={({ pressed }) => [
              s.category,
              category.id === item.id && s.categorySelected,
              pressed && s.pressed,
            ]}
          >
            <Text accessible={false} style={s.categoryIcon}>
              {item.icon}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );
});
const s = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 8,
    right: 8,
    backgroundColor: '#20222D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    elevation: 8,
    boxShadow: '0px 6px 18px #00000040',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4 },
  title: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: '600' },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  closeText: { color: colors.muted, fontSize: 24 },
  categories: { flexGrow: 0, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  categoryList: { padding: 5, gap: 3 },
  category: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySelected: { backgroundColor: '#BCB5FF20', borderWidth: 1, borderColor: '#BCB5FF50' },
  categoryIcon: { fontSize: 22 },
  pressed: { backgroundColor: '#BCB5FF18' },
});
