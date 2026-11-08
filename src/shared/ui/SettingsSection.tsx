import React, { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLayoutMotion } from '../motion/useLayoutMotion';
import { useReducedMotion } from '../motion/useReducedMotion';
import { colors } from '../theme/colors';

/** One accessible disclosure row and a stable form surface, shared across Settings. */
export function SettingsSection({
  title,
  subtitle,
  icon,
  children,
  label = title,
  defaultOpen = false,
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
  label?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [progress] = useState(() => new Animated.Value(defaultOpen ? 1 : 0));
  const reduced = useReducedMotion();
  const animateLayout = useLayoutMotion();
  useEffect(() => {
    progress.stopAnimation();
    if (reduced !== false) {
      progress.setValue(open ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [open, reduced, progress]);
  return (
    <View style={[s.card, open && s.open]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          animateLayout();
          setOpen((value) => !value);
        }}
        style={({ pressed }) => [s.header, pressed && s.pressed]}
      >
        <View accessible={false} style={s.icon}>
          {icon}
        </View>
        <View style={s.identity}>
          <Text numberOfLines={2} style={s.title}>
            {title}
          </Text>
          {!!subtitle && (
            <Text numberOfLines={2} style={s.subtitle}>
              {subtitle}
            </Text>
          )}
        </View>
        <Animated.View
          accessible={false}
          style={[
            s.chevron,
            {
              transform: [
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-45deg', '45deg'],
                  }),
                },
              ],
            },
          ]}
        />
      </Pressable>
      {open && <View style={s.body}>{children}</View>}
    </View>
  );
}

export function SettingsSymbol({
  kind,
}: {
  kind: 'location' | 'language' | 'security' | 'developer';
}) {
  if (kind === 'developer') return <Text style={s.code}>‹/›</Text>;
  if (kind === 'security')
    return (
      <View style={s.lock}>
        <View style={s.shackle} />
        <View style={s.keyhole} />
      </View>
    );
  return (
    <View style={s.circle}>
      {kind === 'location' ? (
        <View style={s.dot} />
      ) : (
        <>
          <View style={s.meridian} />
          <View style={s.equator} />
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: '#191B24',
    borderColor: '#2A2D39',
    borderWidth: 1,
    borderRadius: 22,
    marginBottom: 12,
    overflow: 'hidden',
  },
  open: { borderColor: '#3B3B50' },
  header: { minHeight: 80, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#BCB5FF12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, lineHeight: 18, color: colors.muted },
  chevron: {
    width: 7,
    height: 7,
    borderRightWidth: 1.7,
    borderBottomWidth: 1.7,
    borderColor: colors.muted,
    marginHorizontal: 6,
  },
  body: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 16 },
  pressed: { backgroundColor: '#BCB5FF0C' },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.6,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  meridian: {
    position: 'absolute',
    width: 10,
    height: 20,
    borderRadius: 7,
    borderWidth: 1.2,
    borderColor: colors.accent,
  },
  equator: { height: 1.2, width: 20, backgroundColor: colors.accent },
  lock: {
    width: 20,
    height: 16,
    marginTop: 6,
    borderRadius: 4,
    borderWidth: 1.6,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shackle: {
    position: 'absolute',
    top: -10,
    width: 12,
    height: 10,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1.6,
    borderBottomWidth: 0,
    borderColor: colors.accent,
  },
  keyhole: { width: 2, height: 5, backgroundColor: colors.accent, borderRadius: 1 },
  code: { color: colors.accent, fontSize: 21, fontWeight: '600' },
});
