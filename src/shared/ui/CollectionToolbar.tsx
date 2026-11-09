import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

/** Keep list creation beside the collection, including on short screens. */
export function CollectionToolbar({
  title,
  count,
  action,
  onAction,
  disabled = false,
}: {
  title: string;
  count?: number;
  action: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.row}>
      <View style={s.heading}>
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        {count !== undefined && <Text style={s.count}>{count}</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onAction}
        style={({ pressed }) => [s.action, disabled && s.disabled, pressed && s.pressed]}
      >
        <View accessible={false} style={s.plus}>
          <View style={s.stroke} />
          <View style={[s.stroke, s.vertical]} />
        </View>
        <Text style={s.actionText}>{action}</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 8,
    paddingBottom: 14,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  title: { color: colors.muted, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  count: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.accent,
    maxWidth: '100%',
  },
  actionText: { color: colors.buttonText, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  plus: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  stroke: {
    position: 'absolute',
    width: 12,
    height: 1.8,
    borderRadius: 1,
    backgroundColor: colors.buttonText,
  },
  vertical: { transform: [{ rotate: '90deg' }] },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
