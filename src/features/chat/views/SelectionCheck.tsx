import React, { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { useChatProgress } from './chatMotion';

/** Shared visual only; the surrounding control owns its hit area and accessibility. */
export const SelectionCheck = memo(function SelectionCheck({
  checked,
  mixed = false,
}: {
  checked: boolean;
  mixed?: boolean;
}) {
  const progress = useChatProgress(checked ? 1 : 0, 160);
  return (
    <View accessible={false} pointerEvents="none" style={s.outline}>
      {mixed && !checked && <View style={s.dash} />}
      <Animated.View
        style={[
          s.fill,
          {
            opacity: progress,
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
            ],
          },
        ]}
      >
        <View style={s.tick} />
      </Animated.View>
    </View>
  );
});
const s = StyleSheet.create({
  outline: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#77728F',
    backgroundColor: '#191C26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: 6,
    height: 11,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.buttonText,
    transform: [{ rotate: '45deg' }],
    marginTop: -3,
  },
  dash: { width: 10, height: 2, borderRadius: 1, backgroundColor: colors.accent },
});
