import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import type { useTranslation } from '../i18n/LanguageProvider';

function unreadLabel(count: number) {
  return count > 99 ? '99+' : String(count);
}

export function chatButtonLabel(
  t: ReturnType<typeof useTranslation>['t'],
  name: string,
  unread: number,
) {
  return unread
    ? t('{name}, unread messages: {count}', { name, count: unreadLabel(unread) })
    : name;
}

/** The parent button announces the count. This overlay doesn't change its touch target. */
export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View pointerEvents="none" accessible={false} style={styles.badge}>
      <Text accessible={false} numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.text}>
        {unreadLabel(count)}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 19,
    minHeight: 19,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.input,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.buttonText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
