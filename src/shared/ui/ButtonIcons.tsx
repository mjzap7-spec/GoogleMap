import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export function EmailIcon() {
  return (
    <View accessible={false} style={styles.envelope}>
      <View style={styles.flap} />
    </View>
  );
}

export function GoogleIcon() {
  return (
    <Image
      accessible={false}
      source={require('../../../assets/icons/google.png')}
      style={styles.google}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  envelope: {
    width: 22,
    height: 17,
    borderWidth: 1.8,
    borderColor: colors.buttonText,
    borderRadius: 3,
    overflow: 'hidden',
  },
  flap: {
    position: 'absolute',
    width: 13,
    height: 13,
    left: 2.7,
    top: -7,
    borderLeftWidth: 1.8,
    borderBottomWidth: 1.8,
    borderColor: colors.buttonText,
    transform: [{ rotate: '-45deg' }],
  },
  google: { width: 22, height: 22 },
});
