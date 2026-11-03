import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export function SettingsIcon({ selected = false }: { selected?: boolean }) {
  const color = selected ? colors.accent : colors.text;
  return (
    <View accessible={false} style={styles.icon}>
      {[0, 45, 90, 135].map((angle) => (
        <View
          key={angle}
          style={[styles.teeth, { backgroundColor: color, transform: [{ rotate: `${angle}deg` }] }]}
        />
      ))}
      <View style={[styles.ring, { borderColor: color }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  teeth: {
    position: 'absolute',
    width: 5,
    height: 24,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  ring: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3.5,
    borderColor: colors.text,
    backgroundColor: colors.input,
  },
});
