import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function HelpIcon() {
  return (
    <View accessible={false} style={styles.circle}>
      <Text style={styles.question}>?</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  circle: {
    width: 26,
    height: 26,
    borderWidth: 1.8,
    borderColor: colors.accent,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  question: { fontSize: 19, lineHeight: 22, fontWeight: '700', color: colors.accent },
});
