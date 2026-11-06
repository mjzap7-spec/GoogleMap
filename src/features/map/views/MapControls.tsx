import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { type MapCanvasProps, type MapCommand } from '../models/map';
import { colors } from '../../../shared/theme/colors';

export function MapControls({
  state,
  commands,
  ready,
  send,
}: MapCanvasProps & { ready: boolean; send: (command: MapCommand) => void }) {
  const { t } = useTranslation();

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Clear path')}
        accessibilityState={{ disabled: !state.recordedPoints }}
        disabled={!state.recordedPoints}
        onPress={commands.clearTrail}
        style={({ pressed }) => [
          styles.clearButton,
          !state.recordedPoints && { opacity: 0.45 },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.check}>{t('Clear path')}</Text>
      </Pressable>
      <View style={styles.zoomArea}>
        <View style={styles.zoomGroup}>
          {(['zoom-in', 'zoom-out'] as const).map((action, index) => (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityLabel={index === 0 ? t('Zoom in') : t('Zoom out')}
              accessibilityState={{ disabled: !ready }}
              disabled={!ready}
              onPress={() => send(action)}
              style={({ pressed }) => [
                styles.zoomButton,
                index === 0 && styles.zoomDivider,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.zoomText}>{index === 0 ? '+' : '−'}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Center on GPS position')}
          accessibilityState={{ disabled: !ready || !state.live }}
          disabled={!ready || !state.live}
          onPress={() => send('recenter')}
          style={({ pressed }) => [
            styles.centerButton,
            (!ready || !state.live) && { opacity: 0.5 },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.targetOuter}>
            <View style={styles.targetInner} />
          </View>
        </Pressable>
      </View>
      <View style={styles.locationCard}>
        {!state.live && (state.tracking === 'tracking' || state.tracking === 'requesting') && (
          <ActivityIndicator color={colors.accent} size="small" />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>
            {state.live
              ? state.tracking === 'tracking'
                ? t('Your location')
                : t('Last location')
              : state.tracking === 'error'
                ? t('Location unavailable')
                : t('Locating you…')}
          </Text>
          <Text style={styles.locationSubtitle} numberOfLines={1}>
            {state.live
              ? state.placeName ||
                (state.tracking === 'tracking' ? t('GPS connected') : t('GPS paused'))
              : state.tracking === 'error'
                ? t('Enable GPS to continue')
                : t('Finding your location')}
          </Text>
        </View>
        {state.tracking === 'error' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Retry')}
            accessibilityHint={t(state.trackingError)}
            onPress={commands.resumeTracking}
            style={styles.retry}
          >
            <Text style={styles.check}>{t('Retry')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  clearButton: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    minHeight: 46,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.input,
    justifyContent: 'center',
    elevation: 3,
  },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 28 },
  check: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  zoomArea: { position: 'absolute', right: 16, bottom: 24, gap: 12 },
  zoomGroup: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: colors.input,
    elevation: 4,
  },
  zoomButton: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { borderBottomWidth: 1, borderColor: colors.border },
  zoomText: { color: colors.accent, fontSize: 32, lineHeight: 40, fontWeight: '400' },
  centerButton: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 29,
    backgroundColor: colors.input,
    elevation: 3,
  },
  targetOuter: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  pressed: { backgroundColor: '#292637' },
  locationCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 88,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    elevation: 3,
  },
  locationTitle: { color: colors.text, fontSize: 13, fontWeight: '500', lineHeight: 19 },
  locationSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  locationDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  retry: { minHeight: 36, justifyContent: 'center' },
});
