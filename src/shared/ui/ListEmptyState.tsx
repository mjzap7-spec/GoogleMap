import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function ListEmptyState({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <View style={s.container}>
      <View accessible={false} style={s.icon}>
        {icon}
      </View>
      <Text style={s.message}>{message}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 28, gap: 14 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#BCB5FF10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: 'center',
  },
});
