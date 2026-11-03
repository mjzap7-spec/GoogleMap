import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function HomeIcon({ selected }: { selected: boolean }) {
  const color = selected ? colors.accent : colors.text;
  return (
    <View accessible={false} style={styles.icon}>
      <View style={[styles.roof, { borderColor: color }]} />
      <View style={[styles.house, { borderColor: color }]} />
      <View style={[styles.door, { borderColor: color }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  icon: { width: 26, height: 26, alignItems: 'center' },
  roof: {
    position: 'absolute',
    width: 17,
    height: 17,
    top: 3,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  house: {
    position: 'absolute',
    width: 19,
    height: 15,
    bottom: 1,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.input,
  },
  door: {
    position: 'absolute',
    width: 7,
    height: 10,
    bottom: 1,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
});
