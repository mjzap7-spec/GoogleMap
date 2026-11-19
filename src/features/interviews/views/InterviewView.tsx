import { useCallPress, useCallStageMotion } from './callMotion';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { Avatar } from '../../../shared/ui/Avatar';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
import type { InterviewState, InterviewViewModel } from '../viewmodels/InterviewViewModel';
import { CallIcon, PhoneIcon } from './CallIcon';
import { CallVideo } from './CallVideo';

export function InterviewView({
  state,
  commands,
}: {
  state: InterviewState;
  commands: InterviewViewModel;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const compact = height < 740 || landscape;
  const stageMotion = useCallStageMotion(state.phase);
  const choice = state.phase === 'choose',
    incoming = state.phase === 'incoming',
    ended = state.phase === 'ended';
  const active = !incoming;
  const modeLabel = t(state.mode === 'video' ? 'Video interview' : 'Voice interview');
  const mediaActive =
    !!state.local && ['connecting', 'connected', 'reconnecting', 'outgoing'].includes(state.phase);
  const inCall = state.phase === 'connected' || state.phase === 'reconnecting';
  const remoteVideo = !!state.remote && state.mode === 'video' && inCall;
  const status =
    state.phase === 'outgoing'
      ? 'Calling…'
      : state.phase === 'preparing' || (state.phase === 'connecting' && !state.local)
        ? 'Preparing interview…'
        : state.phase === 'connecting'
          ? 'Connecting…'
          : state.phase === 'reconnecting'
            ? 'Reconnecting…'
            : state.phase === 'connected'
              ? 'Connected'
              : 'Incoming interview';
  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() =>
        choice || ended ? commands.dismiss() : incoming ? commands.decline() : commands.hangUp()
      }
    >
      <View
        style={[
          s.screen,
          {
            paddingTop: insets.top + (compact ? 8 : 20),
            paddingBottom: insets.bottom + (compact ? 8 : 24),
          },
        ]}
      >
        {choice || ended ? (
          <ScrollView
            style={s.chooserScroll}
            contentContainerStyle={s.chooserContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.chooserCard}>
              <View style={s.chooserHeader}>
                <Text accessibilityRole="header" style={s.chooserHeading}>
                  {choice ? t('Interview') : modeLabel}
                </Text>
                {choice && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('Close')}
                    onPress={commands.dismiss}
                    style={({ pressed }) => [s.chooserClose, pressed && s.pressed]}
                  >
                    <Text style={s.chooserCloseText}>×</Text>
                  </Pressable>
                )}
              </View>
              <View style={s.chooserPerson}>
                <View style={s.avatarRing}>
                  <Avatar uri={state.target?.avatarUrl} name={state.target?.name ?? ''} size={76} />
                </View>
                <Text numberOfLines={2} style={s.chooserName}>
                  {state.target?.name}
                </Text>
              </View>
              {choice ? (
                <>
                  <View style={s.chooserOptions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void commands.begin('voice')}
                      style={({ pressed }) => [s.chooserOption, pressed && s.pressed]}
                    >
                      <View style={s.chooserOptionIcon}>
                        <PhoneIcon />
                      </View>
                      <Text style={s.chooserLabel}>{t('Voice call')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void commands.begin('video')}
                      style={({ pressed }) => [s.chooserOption, pressed && s.pressed]}
                    >
                      <View style={s.chooserOptionIcon}>
                        <CallIcon />
                      </View>
                      <Text style={s.chooserLabel}>{t('Video call')}</Text>
                    </Pressable>
                  </View>
                  <Text style={s.chooserNote}>
                    {t('Calls work while both people keep the app open.')}
                  </Text>
                  {state.listeningError && (
                    <Pressable accessibilityRole="button" onPress={commands.retry} style={s.link}>
                      <Text style={s.chooserNote}>
                        {t('Interview connection unavailable. Please retry.')}
                      </Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  <Text accessibilityLiveRegion="polite" style={s.resultStatus}>
                    {t(state.result)}
                  </Text>
                  <View style={s.resultActions}>
                    {!!state.error && (
                      <PrimaryButton
                        busy={false}
                        label={t('Try again')}
                        onPress={commands.retryInterview}
                      />
                    )}
                    <PrimaryButton
                      busy={false}
                      label={t('Close')}
                      variant={state.error ? 'secondary' : undefined}
                      onPress={commands.dismiss}
                    />
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        ) : (
          <>
            {!!state.remote && (
              <View style={[s.remote, !remoteVideo && s.hiddenVideo]}>
                <CallVideo preview={state.remote} />
              </View>
            )}
            <View style={[s.heading, compact && s.compactHeading]}>
              <View style={s.headingIcon}>
                <CallIcon kind={state.mode} />
              </View>
              <Text style={s.title}>{modeLabel}</Text>
            </View>
            <Animated.View
              style={[
                s.identity,
                compact && s.compactIdentity,
                remoteVideo && s.videoIdentity,
                stageMotion,
              ]}
            >
              {!remoteVideo && !landscape && (
                <View style={s.callPortrait}>
                  <View style={[s.avatarRing, s.callAvatarRing]}>
                    <Avatar
                      uri={state.target?.avatarUrl}
                      name={state.target?.name ?? ''}
                      size={compact ? 76 : 104}
                    />
                  </View>
                </View>
              )}
              <Text
                numberOfLines={2}
                style={[s.name, compact && s.compactName, remoteVideo && s.videoName]}
              >
                {state.target?.name}
              </Text>
              {
                <View style={[s.statusPill, remoteVideo && s.videoStatus]}>
                  <View
                    style={[
                      s.statusDot,
                      (incoming || state.phase === 'connected') && s.incomingDot,
                      state.phase === 'reconnecting' && s.reconnectingDot,
                    ]}
                  />
                  <Text accessibilityLiveRegion="polite" style={s.status}>
                    {t(status)}
                  </Text>
                </View>
              }
              {inCall && state.connectedSince !== undefined && (
                <CallClock started={state.connectedSince} overlay={remoteVideo} />
              )}
            </Animated.View>
            {!!state.local && state.mode === 'video' && !landscape && (
              <View
                style={[
                  s.local,
                  compact && s.compactLocal,
                  { top: insets.top + (compact ? 68 : 96) },
                ]}
              >
                {state.cameraOn ? (
                  <CallVideo preview={state.local} local />
                ) : (
                  <View style={s.cameraOff}>
                    <CallIcon off />
                    <Text style={s.previewLabel}>{t('Camera off')}</Text>
                  </View>
                )}
                {state.cameraOn && <Text style={s.previewBadge}>{t('You')}</Text>}
              </View>
            )}
            <View
              style={[s.controls, compact && s.compactControls, remoteVideo && s.videoControls]}
            >
              {incoming && (
                <View style={s.callActions}>
                  <CallAction compact={compact} label={t('Decline')} onPress={commands.decline} />
                  <CallAction
                    compact={compact}
                    label={t('Answer')}
                    onPress={() => void commands.accept()}
                    answer
                  />
                </View>
              )}
              {active && state.muted && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Unmute')}
                  disabled={!mediaActive}
                  onPress={commands.toggleMute}
                  style={({ pressed }) => [s.muteBanner, pressed && { opacity: 0.8 }]}
                >
                  <Text accessibilityLiveRegion="polite" style={s.muteNotice}>
                    {t('Microphone off')}
                  </Text>
                  <Text style={s.unmuteAction}>{t('Unmute')}</Text>
                </Pressable>
              )}
              {active && (
                <View style={s.toggles}>
                  <Control
                    compact={compact}
                    label={t(state.muted ? 'Unmute' : 'Mute')}
                    selected={state.muted}
                    disabled={!mediaActive}
                    onPress={commands.toggleMute}
                  >
                    <CallIcon kind="voice" off={state.muted} />
                  </Control>
                  {state.mode === 'video' && (
                    <>
                      <Control
                        compact={compact}
                        label={t(state.cameraOn ? 'Turn camera off' : 'Turn camera on')}
                        selected={!state.cameraOn}
                        disabled={!mediaActive}
                        onPress={commands.toggleCamera}
                      >
                        <CallIcon off={!state.cameraOn} />
                      </Control>
                      <Control
                        compact={compact}
                        label={t('Switch camera')}
                        disabled={!mediaActive || !state.cameraOn}
                        onPress={commands.switchCamera}
                      >
                        <Text style={s.switchIcon}>↻</Text>
                      </Control>
                    </>
                  )}
                </View>
              )}
              {active && (
                <View style={s.callActions}>
                  <CallAction compact={compact} label={t('End call')} onPress={commands.hangUp} />
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
function CallClock({ started, overlay }: { started: number; overlay: boolean }) {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - started) / 1000)),
  );
  useEffect(() => {
    const timer = setInterval(
      () => setSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [started]);
  return (
    <Text style={[s.status, s.clock, overlay && s.videoStatus]}>
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </Text>
  );
}
function CallAction({
  label,
  onPress,
  answer = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  answer?: boolean;
  compact?: boolean;
}) {
  const press = useCallPress();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={s.callAction}
    >
      <Animated.View
        style={[s.callActionIcon, compact && s.compactActionIcon, answer && s.answer, press.style]}
      >
        <PhoneIcon color="#FFF" hangUp={!answer} />
      </Animated.View>
      <Text style={s.actionLabel}>{label}</Text>
    </Pressable>
  );
}
function Control({
  label,
  selected,
  disabled,
  onPress,
  children,
  compact = false,
}: React.PropsWithChildren<{
  label: string;
  compact?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}>) {
  const press = useCallPress(disabled);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[s.control, compact && s.compactControl, disabled && { opacity: 0.4 }]}
    >
      <Animated.View
        style={[
          s.controlIcon,
          compact && s.compactControlIcon,
          selected && s.selected,
          press.style,
        ]}
      >
        {children}
      </Animated.View>
      <Text numberOfLines={2} style={s.controlLabel}>
        {label}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  compactHeading: { paddingVertical: 6 },
  compactIdentity: { gap: 6 },
  compactName: { fontSize: 22 },
  compactLocal: { width: 76, height: 108, right: 12, borderRadius: 16 },
  compactControls: { gap: 6, paddingTop: 8 },
  compactControl: { minHeight: 68 },
  compactControlIcon: { width: 48, height: 48, borderRadius: 24 },
  compactActionIcon: { width: 56, height: 56, borderRadius: 28 },
  muteBanner: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    backgroundColor: '#D3455A16',
    borderWidth: 1,
    borderColor: '#D3455A30',
    paddingHorizontal: 12,
  },
  unmuteAction: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  muteNotice: { color: '#FFC4CD', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  reconnectingDot: { backgroundColor: '#F0CA7D' },
  cameraOff: {
    flex: 1,
    backgroundColor: '#232635',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewLabel: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  previewBadge: {
    position: 'absolute',
    bottom: 7,
    left: 8,
    backgroundColor: '#101116B0',
    color: '#FFF',
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  remote: { ...StyleSheet.absoluteFill, backgroundColor: '#080A10' },
  hiddenVideo: { opacity: 0 },
  heading: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#151722DC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  headingIcon: { width: 24 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  identity: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  avatarRing: { padding: 6, borderRadius: 60, borderWidth: 1, borderColor: colors.border },
  callPortrait: {
    padding: 9,
    borderRadius: 80,
    backgroundColor: '#BCB5FF0D',
    borderWidth: 1,
    borderColor: '#BCB5FF20',
    marginBottom: 4,
  },
  callAvatarRing: { borderColor: '#BCB5FF50' },
  videoIdentity: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 32,
    paddingRight: 104,
    gap: 8,
  },
  videoName: {
    fontSize: 18,
    textAlign: 'left',
    backgroundColor: '#101116A0',
    padding: 8,
    borderRadius: 12,
  },
  name: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  status: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  statusPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#20222D',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  incomingDot: { backgroundColor: '#69D6A3' },
  videoStatus: { backgroundColor: '#101116E8', padding: 8, borderRadius: 12 },
  clock: {
    minWidth: 76,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  local: {
    position: 'absolute',
    right: 20,
    top: 96,
    width: 96,
    height: 136,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  controls: {
    gap: 16,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingTop: 18,
    paddingBottom: 4,
  },
  videoControls: {
    backgroundColor: '#101116E8',
    borderRadius: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF24',
  },
  chooserScroll: { flex: 1 },
  chooserContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 8 },
  chooserCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 28,
    padding: 16,
    gap: 18,
  },
  chooserHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chooserHeading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  chooserClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BCB5FF12',
  },
  chooserCloseText: { color: colors.text, fontSize: 26, lineHeight: 28 },
  chooserPerson: { alignItems: 'center', gap: 9 },
  chooserName: { color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  resultStatus: { color: colors.muted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  resultActions: { gap: 8 },
  chooserOptions: { flexDirection: 'row', gap: 10 },
  chooserOption: {
    flex: 1,
    minWidth: 0,
    minHeight: 92,
    padding: 10,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#BCB5FF12',
    borderColor: '#BCB5FF30',
    borderWidth: 1,
  },
  chooserOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BCB5FF1F',
  },
  chooserLabel: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  chooserNote: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  toggles: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 6 },
  control: {
    flex: 1,
    maxWidth: 96,
    minHeight: 80,
    alignItems: 'center',
    gap: 5,
  },
  controlIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: '#20222DF2',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: '#403651', borderColor: colors.accent },
  controlLabel: {
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowRadius: 6,
  },
  switchIcon: { color: colors.accent, fontSize: 25, lineHeight: 28 },
  callActions: { flexDirection: 'row', justifyContent: 'center', gap: 32 },
  callAction: { flex: 1, maxWidth: 116, alignItems: 'center', gap: 7 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  callActionIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#C9354B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answer: { backgroundColor: '#167A4D' },
  actionLabel: {
    color: '#FFF',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowRadius: 6,
  },
});
