import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import type {
  DirectTransfersViewModel,
  TransferState,
} from '../viewmodels/DirectTransfersViewModel';

export interface DirectTransferActions {
  state: TransferState;
  send: DirectTransfersViewModel['send'];
  pick: DirectTransfersViewModel['pick'];
  clearDraft: DirectTransfersViewModel['clearDraft'];
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
  const file = actions?.state.files[id];
  const active = actions?.state.active?.id === id ? actions.state.active : undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!record || !['offered', 'accepted'].includes(record.status)) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, record.expiresAt - Date.now()) + 50,
    );
    return () => clearTimeout(timer);
  }, [record]);
  const [brokenImage, setBrokenImage] = useState(false);
  const image =
    !!record &&
    (/^image\/(png|jpeg|gif|webp)$/i.test(record.mime) ||
      /\.(png|jpe?g|gif|webp)$/i.test(record.name));
  const live =
    !!record && ['offered', 'accepted'].includes(record.status) && record.expiresAt > now;
  const percent = record
    ? Math.min(100, Math.floor(((active?.bytes ?? 0) / record.size) * 100))
    : 0;
  const downloadable = !mine && !!file;
  const status = file?.saving
    ? 'Saving…'
    : live
      ? active?.phase === 'transferring'
        ? 'Transferring…'
        : mine
          ? 'Waiting for recipient…'
          : 'Receiving…'
      : record?.status === 'failed'
        ? (actions?.state.failures[id] ?? 'Transfer failed')
        : record?.status === 'cancelled'
          ? 'Transfer cancelled'
          : record?.status === 'declined'
            ? 'Transfer declined'
            : !file && record?.status === 'completed'
              ? 'File is not on this device. Ask the sender to resend.'
              : !file && record
                ? 'File invitation expired. Please send it again.'
                : '';
  return (
    <View style={s.card}>
      <Pressable
        disabled={disabled || !downloadable || file?.saving}
        accessibilityRole={downloadable ? 'button' : undefined}
        accessibilityLabel={downloadable ? `${t('Save file')}: ${record?.name}` : record?.name}
        onPress={(event) => {
          event.stopPropagation();
          void actions?.save(id);
        }}
        style={({ pressed }) => [s.file, pressed && s.pressed]}
      >
        {image && file && !brokenImage && (
          <Image
            source={{ uri: file.uri }}
            style={s.image}
            resizeMode="cover"
            onError={() => setBrokenImage(true)}
            accessibilityLabel={record?.name}
          />
        )}
        <View style={s.row}>
          {!image && (
            <Text style={s.icon} accessible={false}>
              ▤
            </Text>
          )}
          <Text style={s.name} numberOfLines={2}>
            {record?.name ?? t('Direct file transfer')}
          </Text>
          {downloadable && (
            <Text style={s.icon} accessible={false}>
              ↓
            </Text>
          )}
        </View>
      </Pressable>
      {!!status && (
        <Text style={s.caption}>
          {t(status)}
          {active?.phase === 'transferring' ? ` ${percent}%` : ''}
        </Text>
      )}
      {live && active?.phase === 'transferring' && (
        <View
          style={s.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <View style={[s.fill, { width: `${percent}%` }]} />
        </View>
      )}
      {live && (
        <Pressable
          disabled={disabled}
          onPress={(event) => {
            event.stopPropagation();
            actions?.cancel(id);
          }}
          accessibilityRole="button"
          style={s.cancel}
        >
          <Text style={s.action}>{t('Cancel')}</Text>
        </Pressable>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: { minWidth: 160, maxWidth: 250, gap: 6, paddingVertical: 4 },
  file: { gap: 8, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  image: { width: 220, height: 170, borderRadius: 12, backgroundColor: '#FFFFFF10' },
  icon: { color: colors.accent, fontSize: 24 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  caption: { color: '#D4CFE4', fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.7 },
  track: { height: 4, borderRadius: 2, backgroundColor: '#FFFFFF20', overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.accent },
  cancel: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  action: { color: colors.accent, fontSize: 13, fontWeight: '600' },
});
