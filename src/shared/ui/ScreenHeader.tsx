import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { BackButton } from './BackButton';

export function ScreenHeader({
  onBack,
  disabled,
  title,
  count,
  children,
}: {
  onBack: () => void;
  disabled?: boolean;
  title?: string;
  count?: number;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 16,
      }}
    >
      <View style={s.row}>
        <BackButton onPress={onBack} disabled={disabled} />
        {title && (
          <Text accessibilityRole="header" numberOfLines={1} style={s.title}>
            {title}
          </Text>
        )}
        {count !== undefined && <Text style={s.count}>{count}</Text>}
        {children}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  // The persistent Help button occupies the trailing 44-point target.
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 6, paddingRight: 50 },
  title: {
    flexShrink: 1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
  },
  count: {
    color: colors.accent,
    backgroundColor: '#BCB5FF18',
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
