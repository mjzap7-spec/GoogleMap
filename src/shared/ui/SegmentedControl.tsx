import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '../motion/useReducedMotion';
import { colors } from '../theme/colors';

export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [position] = useState(() => new Animated.Value(index));
  const reduced = useReducedMotion();
  useEffect(() => {
    position.stopAnimation();
    if (reduced !== false) {
      position.setValue(index);
      return;
    }
    const animation = Animated.timing(position, {
      toValue: index,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [index, position, reduced]);
  const segmentWidth = Math.max(0, (width - 8) / Math.max(1, options.length));
  return (
    <View style={s.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.selection,
            {
              width: segmentWidth,
              transform: [{ translateX: Animated.multiply(position, segmentWidth) }],
            },
          ]}
        />
      )}
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => {
            if (option.value !== value) onChange(option.value);
          }}
          style={({ pressed }) => [s.tab, pressed && { opacity: 0.7 }]}
        >
          <Text style={[s.label, value === option.value && s.active]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, backgroundColor: colors.input, borderRadius: 18 },
  selection: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 14,
    backgroundColor: '#BCB5FF20',
    borderWidth: 1,
    borderColor: '#BCB5FF50',
  },
  tab: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  active: { color: colors.text },
});
