import React from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { useChatProgress } from './chatMotion';

/** Fixed width keeps the timestamp and bubble still when the second check appears. */
export function MessageChecks({ read }: { read: boolean }) {
  const { t } = useTranslation();
  const progress = useChatProgress(read ? 1 : 0, 140);
  return (
    <View accessible accessibilityLabel={t(read ? 'Read' : 'Sent')} style={s.status}>
      <View style={[s.check, read && s.read]} />
      <Animated.View style={[s.check, s.second, s.read, { opacity: progress }]} />
    </View>
  );
}
const s = StyleSheet.create({
  status: { width: 21, height: 14 },
  check: {
    position: 'absolute',
    top: 1,
    left: 3,
    width: 5,
    height: 9,
    borderRightWidth: 1.7,
    borderBottomWidth: 1.7,
    borderColor: '#C9C5D9',
    transform: [{ rotate: '42deg' }],
  },
  second: { left: 10 },
  read: { borderColor: '#D5CEFF' },
});
