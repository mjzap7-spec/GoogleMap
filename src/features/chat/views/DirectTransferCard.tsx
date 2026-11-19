import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import type {
  DirectTransfersViewModel,
  TransferState,
} from '../viewmodels/DirectTransfersViewModel';

export interface DirectTransferActions {
  state: TransferState;
  send: DirectTransfersViewModel['send'];
  accept: DirectTransfersViewModel['accept'];
  cancel: DirectTransfersViewModel['cancel'];
  save: DirectTransfersViewModel['save'];
}
export function DirectTransferCard({
  id,
  mine,
  actions,
  disabled,
}: {
  id: string;
  mine: boolean;
  actions?: DirectTransferActions;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const record = actions?.state.records[id];
  const active = actions?.state.active?.id === id ? actions.state.active : undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!record || record.status !== 'offered') return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, record.expiresAt - Date.now()) + 50,
    );
    return () => clearTimeout(timer);
  }, [record]);
  const offered = record?.status === 'offered' && record.expiresAt > now;
  const live = active && ['waiting', 'connecting', 'transferring'].includes(active.phase);
  const ready = active?.phase === 'ready';
  const progress = record
    ? Math.min(100, Math.floor(((active?.bytes ?? 0) / record.size) * 100))
    : 0;
  const label = ready
    ? 'Ready to save'
    : active?.phase === 'transferring'
      ? 'Transferring…'
      : active?.phase === 'connecting'
        ? 'Connecting…'
        : record?.status === 'completed'
          ? 'Transfer completed'
          : record?.status === 'declined'
            ? 'Transfer declined'
            : record?.status === 'cancelled'
              ? 'Transfer cancelled'
              : record?.status === 'failed'
                ? 'Transfer failed'
                : offered
                  ? mine
                    ? 'Waiting for acceptance'
                    : 'File transfer invitation'
                  : record
                    ? 'File invitation expired. Please send it again.'
                    : 'File invitation is no longer available.';
  const button = (text: string, onPress: () => void, primary = false, busy = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        primary && s.primary,
        (pressed || disabled || busy) && s.dim,
      ]}
    >
      <Text style={[s.action, primary && s.primaryText]}>{t(text)}</Text>
    </Pressable>
  );
  return (
    <View style={s.card}>
      <View style={s.heading}>
        <Text accessible={false} style={s.icon}>
          ⇄
        </Text>
        <View style={s.details}>
          <Text style={s.name} numberOfLines={2}>
            {record?.name ?? t('Direct file transfer')}
          </Text>
          <Text style={s.caption}>
            {record ? `${(record.size / 1048576).toFixed(1)} MB · ` : ''}
            {t('Private · device to device')}
          </Text>
        </View>
      </View>
      <Text style={s.caption}>
        {t(label)}
        {active?.phase === 'transferring' ? ` ${progress}%` : ''}
      </Text>
      {active && (active.phase === 'transferring' || ready) && (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: progress }}
          style={s.track}
        >
          <View style={[s.fill, { width: `${progress}%` }]} />
        </View>
      )}
      {actions && (
        <View style={s.actions}>
          {offered &&
            !mine &&
            !active &&
            button('Accept', () => void actions.accept(id), true, actions.state.busy)}
          {offered && !mine && !active && button('Decline', () => actions.cancel(id))}
          {(live || (offered && mine)) && button('Cancel', () => actions.cancel(id))}
          {ready &&
            button(
              active.saving ? 'Saving…' : 'Save file',
              () => void actions.save(id),
              true,
              active.saving,
            )}
          {ready && button('Dismiss', () => actions.cancel(id), false, active.saving)}
        </View>
      )}
      {(offered || live || ready) && (
        <Text style={s.note}>
          {t(ready ? 'Save before leaving this chat.' : 'Keep this chat open on both devices.')}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: { minWidth: 210, maxWidth: 290, gap: 10, paddingVertical: 6 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 28, color: colors.accent },
  details: { flexShrink: 1, gap: 4 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  caption: { color: '#D4CFE4', fontSize: 12, lineHeight: 17 },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  track: { height: 5, borderRadius: 3, backgroundColor: '#FFFFFF20', overflow: 'hidden' },
  fill: { height: 5, backgroundColor: colors.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF12',
  },
  primary: { backgroundColor: colors.accent },
  action: { color: colors.accent, fontWeight: '600' },
  primaryText: { color: colors.buttonText },
  dim: { opacity: 0.5 },
});
