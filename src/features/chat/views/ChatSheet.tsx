import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { colors } from '../../../shared/theme/colors';
import { EditIcon } from '../../../shared/ui/ChatIcon';

type Dismiss = (then?: () => void) => void;
export function ChatSheet({
  title,
  busy = false,
  error,
  onClose,
  children,
}: {
  title: string;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  children: (dismiss: Dismiss) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (reduced !== false) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  const dismiss: Dismiss = (then) => {
    if (busy || closing) return;
    setClosing(true);
    const done = () => {
      onClose();
      then?.();
    };
    if (reduced !== false) {
      done();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) done();
    });
  };
  return (
    <Modal
      transparent
      visible
      animationType="none"
      hardwareAccelerated
      onRequestClose={() => dismiss()}
    >
      <View
        style={[
          s.overlay,
          { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, s.scrim, { opacity: progress }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Close')}
          onPress={() => dismiss()}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            s.sheet,
            {
              opacity: progress,
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            },
          ]}
        >
          <View style={s.handle} />
          <View style={s.heading}>
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Close')}
              onPress={() => dismiss()}
              disabled={busy}
              style={s.close}
            >
              <Text style={s.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            pointerEvents={closing ? 'none' : 'auto'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
          >
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {t(error)}
              </Text>
            )}
            {children(dismiss)}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
export function DeleteIcon({ color = '#FFB4BE' }: { color?: string }) {
  return (
    <View accessible={false} style={[s.bin, { borderColor: color }]}>
      <View style={[s.lid, { backgroundColor: color }]} />
      <View style={[s.binHandle, { borderColor: color }]} />
      <View style={[s.binLine, { backgroundColor: color }]} />
    </View>
  );
}
export function ChatActionRow({
  label,
  kind,
  onPress,
  danger = false,
}: {
  label: string;
  kind: 'reply' | 'edit' | 'select' | 'delete';
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.action, pressed && s.pressed]}
    >
      <View style={[s.icon, danger && s.dangerIcon]}>
        {kind === 'delete' ? (
          <DeleteIcon color={danger ? '#FFB4BE' : colors.accent} />
        ) : kind === 'edit' ? (
          <EditIcon />
        ) : (
          <Text style={s.symbol}>{kind === 'reply' ? '↩' : '✓'}</Text>
        )}
      </View>
      <Text style={[s.label, danger && s.danger]}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 12 },
  scrim: { backgroundColor: '#00000088' },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#1C1F29',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#3A3C4B',
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  handle: {
    width: 32,
    height: 4,
    backgroundColor: '#626174',
    alignSelf: 'center',
    borderRadius: 2,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, marginTop: 4 },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 26, color: colors.muted },
  body: { paddingBottom: 12 },
  error: {
    color: '#FFB4BE',
    fontSize: 13,
    lineHeight: 19,
    padding: 10,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#FFB4BE0C',
  },
  action: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  pressed: { backgroundColor: '#BCB5FF14' },
  label: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '500' },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#BCB5FF10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIcon: { backgroundColor: '#FFB4BE0C' },
  symbol: { color: colors.accent, fontSize: 22 },
  bin: { width: 15, height: 16, borderWidth: 1.6, borderRadius: 3, marginTop: 4 },
  lid: { position: 'absolute', top: -4, left: -4, width: 20, height: 1.6, borderRadius: 2 },
  binHandle: {
    position: 'absolute',
    top: -7,
    left: 3,
    width: 6,
    height: 4,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  binLine: { position: 'absolute', top: 3, left: 5, width: 1.5, height: 7, borderRadius: 1 },
  danger: { color: '#FFB4BE' },
});
