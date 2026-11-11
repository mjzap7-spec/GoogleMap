import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const choice = state.phase === 'choose',
    incoming = state.phase === 'incoming',
    ended = state.phase === 'ended';
  const active = !incoming;
  const modeLabel = t(state.mode === 'video' ? 'Video interview' : 'Voice interview');
  const mediaActive =
    !!state.local && ['connecting', 'connected', 'reconnecting', 'outgoing'].includes(state.phase);
  const inCall = state.phase === 'connected' || state.phase === 'reconnecting';
  const remoteVideo = !!state.remote && state.mode === 'video';
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
      <View style={[s.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
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
            <View style={s.heading}>
              <View style={s.headingIcon}>
                <CallIcon kind={state.mode} />
              </View>
              <Text style={s.title}>{modeLabel}</Text>
            </View>
            <View style={[s.identity, remoteVideo && s.videoIdentity]}>
              {!remoteVideo && (
                <View style={s.avatarRing}>
                  <Avatar
                    uri={state.target?.avatarUrl}
                    name={state.target?.name ?? ''}
                    size={104}
                  />
                </View>
              )}
              <Text numberOfLines={2} style={[s.name, remoteVideo && s.videoName]}>
                {state.target?.name}
              </Text>
              {state.phase !== 'connected' && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[s.status, remoteVideo && s.videoStatus]}
                >
                  {t(status)}
                </Text>
              )}
              {inCall && <CallClock visible={state.phase === 'connected'} overlay={remoteVideo} />}
            </View>
            {!!state.local && state.mode === 'video' && state.cameraOn && (
              <View style={[s.local, { top: insets.top + 96 }]}>
                <CallVideo preview={state.local} local />
              </View>
            )}
            <View style={[s.controls, remoteVideo && s.videoControls]}>
              {incoming && (
                <View style={s.callActions}>
                  <CallAction label={t('Decline')} onPress={commands.decline} />
                  <CallAction label={t('Answer')} onPress={() => void commands.accept()} answer />
                </View>
              )}
              {mediaActive && (
                <View style={s.toggles}>
                  <Control
                    label={t(state.muted ? 'Unmute' : 'Mute')}
                    selected={state.muted}
                    onPress={commands.toggleMute}
                  >
                    <CallIcon kind="voice" />
                  </Control>
                  {state.mode === 'video' && (
                    <>
                      <Control
                        label={t(state.cameraOn ? 'Turn camera off' : 'Turn camera on')}
                        selected={!state.cameraOn}
                        onPress={commands.toggleCamera}
                      >
                        <CallIcon />
                      </Control>
                      <Control
                        label={t('Switch camera')}
                        disabled={!state.cameraOn}
                        onPress={commands.switchCamera}
                      >
                        <Text style={s.switchIcon}>↻</Text>
                      </Control>
                    </>
                  )}
                </View>
              )}
              {active && !mediaActive && <View style={s.controlsPlaceholder} />}
              {active && (
                <View style={s.callActions}>
                  <CallAction label={t('End call')} onPress={commands.hangUp} />
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
function CallClock({ visible, overlay }: { visible: boolean; overlay: boolean }) {
  const [started] = useState(Date.now);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [started]);
  if (!visible) return null;
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
}: {
  label: string;
  onPress: () => void;
  answer?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.callAction, pressed && s.pressed]}
    >
      <View style={[s.callActionIcon, answer && s.answer]}>
        <PhoneIcon color="#FFF" hangUp={!answer} />
      </View>
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
}: React.PropsWithChildren<{
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.control, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <View style={[s.controlIcon, selected && s.selected]}>{children}</View>
      <Text numberOfLines={2} style={s.controlLabel}>
        {label}
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
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
  videoStatus: { backgroundColor: '#101116D0', padding: 8, borderRadius: 12 },
  clock: { color: colors.text, fontVariant: ['tabular-nums'] },
  controlsPlaceholder: { height: 86 },
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
  controls: { gap: 12, width: '100%', maxWidth: 480, alignSelf: 'center' },
  videoControls: { backgroundColor: '#101116D9', borderRadius: 28, paddingVertical: 12 },
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
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: '#20222DF2',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: '#534862' },
  controlLabel: {
    color: colors.text,
    fontSize: 11,
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
