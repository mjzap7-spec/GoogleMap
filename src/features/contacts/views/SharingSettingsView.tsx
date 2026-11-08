import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { SettingsSection, SettingsSymbol } from '../../../shared/ui/SettingsSection';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import type { SharingState, SharingViewModel } from '../viewmodels/SharingViewModel';

export function SharingSettingsView({
  state,
  onChange,
  onStopAll,
  groupNames,
  recording,
  onRecording,
  recordingDisabled,
  showPeople,
  onShowPeople,
}: {
  state: Readonly<SharingState>;
  onChange: SharingViewModel['savePreferences'];
  onStopAll: SharingViewModel['stopAllSharing'];
  groupNames: string[];
  recording: boolean;
  onRecording: () => void;
  recordingDisabled: boolean;
  showPeople: boolean;
  onShowPeople: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const disabled = !state.ready || state.busy;
  const audience = state.preferences.groups
    ? 'groups'
    : state.preferences.nearby
      ? 'nearby'
      : 'off';
  const trip = state.groups.find((group) => group.id === state.tripGroupId);
  const sharing = audience !== 'off' || !!state.tripGroupId;
  return (
    <SettingsSection
      title={t('Location sharing')}
      subtitle={t(
        state.stopPending
          ? 'Stopping sharing…'
          : state.tripGroupId
            ? 'Sharing trip'
            : audience === 'groups'
              ? 'My groups'
              : audience === 'nearby'
                ? 'Nearby users'
                : 'No one',
      )}
      icon={<SettingsSymbol kind="location" />}
    >
      <View style={s.content}>
        <View style={s.summary}>
          <View style={[s.dot, sharing && s.activeDot]} />
          <View style={s.copy}>
            <Text style={s.label}>
              {t(
                !state.ready
                  ? 'Loading sharing settings…'
                  : state.stopPending
                    ? 'Stopping sharing…'
                    : sharing
                      ? 'Your location is shared'
                      : 'Your location is hidden',
              )}
            </Text>
            <Text style={s.description}>{t('Live sharing works while the app is open.')}</Text>
          </View>
        </View>
        <Text style={s.label}>{t('Who can see me')}</Text>
        <View style={s.choices} accessibilityRole="radiogroup">
          {(['off', 'nearby', 'groups'] as const).map((value) => {
            const label = t(
              value === 'off' ? 'No one' : value === 'nearby' ? 'Nearby users' : 'My groups',
            );
            const selected = audience === value && (value !== 'off' || !state.tripGroupId);
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                onPress={() =>
                  value === 'off'
                    ? onStopAll()
                    : onChange({ nearby: value === 'nearby', groups: value === 'groups' })
                }
                style={({ pressed }) => [s.choice, selected && s.selected, pressed && s.pressed]}
              >
                <Text style={[s.choiceText, selected && s.selectedText]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.description}>
          {t(
            audience === 'groups'
              ? 'Only members of groups you joined can see your location.'
              : audience === 'nearby'
                ? 'Signed-in users within 1 km can see you.'
                : state.tripGroupId
                  ? 'Only your active trip is shared with its group.'
                  : 'Your location is not shared with nearby users or groups.',
          )}
        </Text>
        {audience === 'groups' && (
          <Text style={s.audience}>
            {groupNames.length
              ? groupNames.join(' · ')
              : t('Join a group to share with its members.')}
          </Text>
        )}
        {!!state.tripGroupId && (
          <View style={s.trip}>
            <Text style={s.label}>{t('Sharing trip')}</Text>
            <Text style={s.description}>{trip?.name ?? t('Private group')}</Text>
          </View>
        )}
        {(sharing || state.stopPending) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Stop all sharing')}
            disabled={disabled}
            onPress={onStopAll}
            style={({ pressed }) => [s.stop, pressed && s.pressed, disabled && { opacity: 0.6 }]}
          >
            {state.action === 'stop-sharing' ? (
              <ActivityIndicator color="#ffb4be" />
            ) : (
              <Text style={s.stopText}>
                {t(state.stopPending ? 'Retry stopping sharing' : 'Stop all sharing')}
              </Text>
            )}
          </Pressable>
        )}
        {!!state.error && (
          <Text accessibilityRole="alert" style={s.error}>
            {t(
              state.stopPending
                ? 'Sharing stopped on this device. Could not confirm removal online. Retry when connected.'
                : 'Could not update sharing. Try again.',
            )}
          </Text>
        )}
        <View style={s.divider} />
        <View style={s.row}>
          <View style={s.copy}>
            <Text style={s.label}>{t('Record my path')}</Text>
            <Text style={s.description}>
              {t('Record a path on this device. Sharing is controlled separately.')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t('Record my path')}
            value={recording}
            disabled={recordingDisabled}
            onValueChange={onRecording}
            thumbColor={recording ? colors.accent : colors.muted}
            trackColor={{ false: colors.border, true: '#675E9A' }}
          />
        </View>
        <View style={s.row}>
          <View style={s.copy}>
            <Text style={s.label}>{t('Show people on my map')}</Text>
            <Text style={s.description}>
              {t('Show people who share with you. This does not share your location.')}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t('Show people on my map')}
            value={showPeople}
            onValueChange={onShowPeople}
            thumbColor={showPeople ? colors.accent : colors.muted}
            trackColor={{ false: colors.border, true: '#675E9A' }}
          />
        </View>
      </View>
    </SettingsSection>
  );
}
const s = StyleSheet.create({
  content: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  copy: { flex: 1, gap: 4 },
  label: { color: colors.text, fontWeight: '600', fontSize: 14 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.background,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted },
  activeDot: { backgroundColor: colors.accent },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexGrow: 1,
    flexBasis: 80,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
  },
  selected: { backgroundColor: '#BCB5FF20', borderColor: colors.accent },
  choiceText: { color: colors.muted, fontWeight: '600', fontSize: 13, textAlign: 'center' },
  selectedText: { color: colors.accent },
  audience: { color: colors.accent, fontSize: 12, lineHeight: 18 },
  trip: { padding: 12, gap: 4, borderRadius: 14, backgroundColor: '#BCB5FF12' },
  stop: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffb4be50',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  stopText: { color: '#ffb4be', fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  pressed: { opacity: 0.7 },
  error: { color: '#ffb4be', lineHeight: 20, fontSize: 12 },
});
