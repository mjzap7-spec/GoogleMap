import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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

const GroupedSettings = createContext(false);

/** A single surface for related settings, with inset separators instead of separate cards. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.group}>
      <Text accessibilityRole="header" style={s.groupTitle}>
        {title}
      </Text>
      <View style={s.groupSurface}>
        <GroupedSettings.Provider value>{children}</GroupedSettings.Provider>
      </View>
    </View>
  );
}

/** One accessible disclosure row and a stable form surface, shared across Settings. */
export function SettingsSection({
  title,
  subtitle,
  icon,
  children,
  label = title,
  defaultOpen = false,
  disabled = false,
  variant = 'standard',
  actionLabel,
  value,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
  label?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  variant?: 'standard' | 'profile';
  actionLabel?: string;
  value?: string;
}) {
  const grouped = useContext(GroupedSettings);
  const profile = variant === 'profile';
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
    <View style={[s.card, profile && s.profileCard, open && s.open, grouped && s.groupedCard]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, disabled }}
        accessibilityValue={value ? { text: value } : undefined}
        disabled={disabled}
        onPress={() => {
          Keyboard.dismiss();
          animateLayout();
          setOpen((value) => !value);
        }}
        style={({ pressed }) => [
          s.header,
          profile && s.profileHeader,
          pressed && s.pressed,
          disabled && s.disabled,
        ]}
      >
        <View accessible={false} style={[s.icon, profile && s.profileIcon]}>
          {icon}
        </View>
        <View style={s.identity}>
          <Text numberOfLines={2} style={[s.title, profile && s.profileTitle]}>
            {title}
          </Text>
          {!!subtitle && (
            <Text numberOfLines={2} style={s.subtitle}>
              {subtitle}
            </Text>
          )}
          {!!actionLabel && (
            <View style={s.actionPill}>
              <Text style={s.actionLabel}>{actionLabel}</Text>
            </View>
          )}
        </View>
        {!!value && (
          <Text numberOfLines={2} style={s.value}>
            {value}
          </Text>
        )}
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
      {grouped && <View style={s.separator} />}
    </View>
  );
}

export function SettingsSignOut({
  label,
  onPress,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy || disabled }}
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [s.signOut, pressed && s.signOutPressed, disabled && s.disabled]}
    >
      <View accessible={false} style={s.signOutIcon}>
        {busy ? (
          <ActivityIndicator color="#F1A6B1" />
        ) : (
          <>
            <View style={s.door} />
            <View style={s.arrowStem} />
            <View style={s.arrowHead} />
          </>
        )}
      </View>
      <Text style={s.signOutLabel}>{label}</Text>
    </Pressable>
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
  group: { marginBottom: 18 },
  groupTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginLeft: 4,
    marginBottom: 10,
  },
  groupSurface: {
    backgroundColor: colors.input,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#292C38',
    overflow: 'hidden',
  },
  card: {
    backgroundColor: colors.input,
    borderColor: '#292C38',
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  groupedCard: { borderWidth: 0, borderRadius: 0, marginBottom: 0 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 66, backgroundColor: '#292C38' },
  open: { borderColor: '#3B3B50' },
  header: {
    minHeight: 70,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#BCB5FF12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 12, lineHeight: 18, color: colors.muted },
  value: { maxWidth: '40%', fontSize: 13, color: colors.muted, textAlign: 'right' },
  profileCard: { backgroundColor: '#1B1D29', borderColor: '#363648', marginBottom: 20 },
  profileHeader: { padding: 16, paddingVertical: 18, minHeight: 116, gap: 12 },
  profileIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#BCB5FF12',
    borderWidth: 1,
    borderColor: '#BCB5FF40',
  },
  profileTitle: { fontSize: 22, lineHeight: 28, letterSpacing: -0.4, fontWeight: '700' },
  actionPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#BCB5FF16',
    borderRadius: 8,
    marginTop: 7,
  },
  actionLabel: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  chevron: {
    width: 7,
    height: 7,
    borderRightWidth: 1.7,
    borderBottomWidth: 1.7,
    borderColor: colors.muted,
    marginHorizontal: 6,
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#292C38',
    backgroundColor: '#14161E',
    padding: 16,
  },
  pressed: { backgroundColor: '#BCB5FF0C' },
  disabled: { opacity: 0.55 },
  signOut: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#211A22',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  signOutPressed: { backgroundColor: '#2D202A' },
  signOutLabel: { color: '#F1A6B1', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  signOutIcon: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  door: {
    width: 12,
    height: 20,
    borderWidth: 1.6,
    borderRightWidth: 0,
    borderColor: '#F1A6B1',
    borderRadius: 3,
    position: 'absolute',
    left: 1,
  },
  arrowStem: { height: 1.6, width: 16, backgroundColor: '#F1A6B1', position: 'absolute', left: 8 },
  arrowHead: {
    width: 8,
    height: 8,
    borderTopWidth: 1.6,
    borderRightWidth: 1.6,
    borderColor: '#F1A6B1',
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    right: 3,
  },
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
