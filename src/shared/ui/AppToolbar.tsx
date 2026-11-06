import { ContactsIcon } from './ContactsIcon';
import { ChatIcon } from './ChatIcon';
import { chatButtonLabel } from './UnreadBadge';
import { useTranslation } from '../i18n/LanguageProvider';
import React, { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { useReducedMotion } from '../motion/useReducedMotion';
import { SettingsIcon } from './SettingsIcon';
import { HomeIcon } from './HomeIcon';

const nativeDriver = Platform.OS !== 'web';
export const TOOLBAR_CONTENT_HEIGHT = 70;

function useProgress(active: boolean, enabled: boolean) {
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));
  useEffect(() => {
    progress.stopAnimation();
    if (!enabled) {
      progress.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [active, enabled, progress]);
  return progress;
}

/** Keep the touch target fixed; only its visual surface animates. */
function ToolbarButton({
  label,
  onPress,
  selected,
  expanded,
  enabled,
  raised = false,
  disabled = false,
  hint,
  children,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  expanded?: boolean;
  enabled: boolean;
  raised?: boolean;
  disabled?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!enabled) {
      scale.setValue(1);
      opacity.setValue(1);
    }
    return () => {
      scale.stopAnimation();
      opacity.stopAnimation();
    };
  }, [enabled, scale, opacity]);
  const press = (down: boolean) => {
    scale.stopAnimation();
    opacity.stopAnimation();
    if (!enabled) return;
    Animated.parallel([
      Animated.spring(scale, {
        toValue: down ? 0.93 : 1,
        stiffness: 380,
        damping: 28,
        mass: 0.7,
        overshootClamping: true,
        useNativeDriver: nativeDriver,
      }),
      Animated.timing(opacity, {
        toValue: down ? 0.76 : 1,
        duration: down ? 50 : 110,
        useNativeDriver: nativeDriver,
      }),
    ]).start();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, expanded, disabled }}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => press(true)}
      onPressOut={() => press(false)}
      style={[raised ? styles.menuTarget : styles.buttonTarget, disabled && { opacity: 0.45 }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          raised ? styles.menuSurface : styles.buttonSurface,
          { opacity, transform: [{ scale }] },
        ]}
      >
        {raised && <View style={styles.menuRing} />}
        {children}
      </Animated.View>
    </Pressable>
  );
}
function ActiveIcon({ progress, children }: { progress: Animated.Value; children: ReactNode }) {
  return (
    <View accessible={false} style={styles.iconLayers}>
      <Animated.View style={[styles.activeIndicator, { opacity: progress }]} />
      {children}
    </View>
  );
}
export const AppToolbar = React.memo(function AppToolbar({
  recording,
  onToggleRecording,
  recordingDisabled,
  recordingHint,
  bottomInset,
  onSettings,
  onHome,
  onContacts,
  onChat,
  unread,
  activePage,
}: {
  recording: boolean;
  onToggleRecording: () => void;
  recordingDisabled?: boolean;
  recordingHint?: string;
  bottomInset: number;
  onSettings: () => void;
  onHome: () => void;
  onContacts: () => void;
  onChat: () => void;
  unread: number;
  activePage: 'home' | 'contacts' | 'settings' | 'chat' | 'help';
}) {
  const { t } = useTranslation();

  const enabled = useReducedMotion() === false;
  const contactsProgress = useProgress(activePage === 'contacts', enabled);
  const homeProgress = useProgress(activePage === 'home', enabled);
  const settingsProgress = useProgress(activePage === 'settings', enabled);
  const chatProgress = useProgress(activePage === 'chat', enabled);
  const recordingProgress = useProgress(recording, enabled);
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 12) }]}>
      <View style={styles.row}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View key={index} style={styles.slot}>
            {index === 0 ? (
              <ToolbarButton
                label={t('Home')}
                selected={activePage === 'home'}
                enabled={enabled}
                onPress={onHome}
              >
                <ActiveIcon progress={homeProgress}>
                  <HomeIcon selected />
                </ActiveIcon>
              </ToolbarButton>
            ) : index === 2 ? (
              <ToolbarButton
                label={recording ? t('Pause') : t('Start recording')}
                selected={recording}
                disabled={recordingDisabled}
                hint={recordingHint}
                enabled={enabled}
                onPress={onToggleRecording}
                raised
              >
                <View accessible={false} style={styles.menuGlyph}>
                  <Animated.View
                    style={[
                      styles.play,
                      {
                        opacity: recordingProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0],
                        }),
                      },
                    ]}
                  />
                  <Animated.View style={[styles.pauseGlyph, { opacity: recordingProgress }]}>
                    <View style={styles.pauseLine} />
                    <View style={styles.pauseLine} />
                  </Animated.View>
                </View>
              </ToolbarButton>
            ) : index === 1 ? (
              <ToolbarButton
                label={t('Manage contacts')}
                selected={activePage === 'contacts'}
                enabled={enabled}
                onPress={onContacts}
              >
                <ActiveIcon progress={contactsProgress}>
                  <ContactsIcon />
                </ActiveIcon>
              </ToolbarButton>
            ) : index === 3 ? (
              <ToolbarButton
                label={t('Settings')}
                selected={activePage === 'settings'}
                enabled={enabled}
                onPress={onSettings}
              >
                <ActiveIcon progress={settingsProgress}>
                  <SettingsIcon selected />
                </ActiveIcon>
              </ToolbarButton>
            ) : (
              <ToolbarButton
                label={chatButtonLabel(t, t('Chats'), unread)}
                selected={activePage === 'chat'}
                enabled={enabled}
                onPress={onChat}
              >
                <ActiveIcon progress={chatProgress}>
                  <ChatIcon unread={unread} />
                </ActiveIcon>
              </ToolbarButton>
            )}
          </View>
        ))}
      </View>
    </View>
  );
});
const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingTop: 12,
    zIndex: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    height: 58,
    backgroundColor: colors.input,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 58 },
  buttonTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  buttonSurface: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  iconLayers: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 17,
    backgroundColor: '#BCB5FF18',
    borderWidth: 1,
    borderColor: '#BCB5FF28',
  },
  menuTarget: { position: 'absolute', bottom: 8, width: 66, height: 66 },
  menuSurface: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.input,
    borderWidth: 5,
    borderColor: colors.background,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  menuRing: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 6,
    right: 6,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#BCB5FF66',
  },
  menuGlyph: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  play: {
    position: 'absolute',
    marginLeft: 4,
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.accent,
  },
  pauseGlyph: { position: 'absolute', flexDirection: 'row', gap: 6 },
  pauseLine: { width: 5, height: 22, borderRadius: 2, backgroundColor: colors.accent },
  line: {
    position: 'absolute',
    width: 23,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
