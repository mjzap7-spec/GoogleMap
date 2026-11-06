import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { UnreadBadge } from './UnreadBadge';

export function ChatIcon({ unread }: { unread: number }) {
  return (
    <View accessible={false} pointerEvents="none">
      <Image
        accessible={false}
        source={require('../../../assets/icons/chat-bubbles.png')}
        style={styles.icon}
      />
      <UnreadBadge count={unread} />
    </View>
  );
}
export function InboxIcon() {
  return (
    <Image
      accessible={false}
      source={require('../../../assets/icons/inbox-tray.png')}
      style={styles.icon}
    />
  );
}
export function EditIcon() {
  return (
    <View accessible={false} style={styles.pencil}>
      <View style={styles.tip} />
    </View>
  );
}
const styles = StyleSheet.create({
  icon: { width: 26, height: 26, tintColor: colors.accent },
  pencil: {
    width: 6,
    height: 19,
    borderWidth: 1.7,
    borderColor: colors.accent,
    borderRadius: 2,
    transform: [{ rotate: '40deg' }],
  },
  tip: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderRightWidth: 2,
    borderColor: 'transparent',
    borderTopColor: colors.accent,
  },
});
