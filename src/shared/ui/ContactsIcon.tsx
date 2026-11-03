import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
export function ContactsIcon() {
  return (
    <View accessible={false} style={styles.icon}>
      <View style={styles.backHead} />
      <View style={styles.backBody} />
      <View style={styles.head} />
      <View style={styles.body} />
    </View>
  );
}
const styles = StyleSheet.create({
  icon: { width: 28, height: 28 },
  head: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.8,
    borderColor: colors.accent,
    left: 5,
    top: 3,
    backgroundColor: colors.input,
  },
  body: {
    position: 'absolute',
    width: 17,
    height: 11,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 1.8,
    borderColor: colors.accent,
    left: 1,
    top: 15,
    backgroundColor: colors.input,
  },
  backHead: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 5,
    borderWidth: 1.8,
    borderColor: colors.accent,
    left: 17,
    top: 5,
  },
  backBody: {
    position: 'absolute',
    width: 12,
    height: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1.8,
    borderColor: colors.accent,
    left: 14,
    top: 16,
  },
});
