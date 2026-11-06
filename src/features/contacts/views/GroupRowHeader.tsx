import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import type { GroupSummary } from '../models/sharing';

interface Props {
  group: GroupSummary;
  expanded: boolean;
  onToggle?: () => void;
  onJoin?: () => void;
  joining: boolean;
  disabled: boolean;
}

export function GroupRowHeader({ group, expanded, onToggle, onJoin, joining, disabled }: Props) {
  const { language, t } = useTranslation();
  const date = useMemo(
    () =>
      group.createdAt != null &&
      new Date(group.createdAt).toLocaleDateString(language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [group.createdAt, language],
  );
  const count = group.memberCount;
  const details = [
    date,
    count != null && t(count === 1 ? '1 member' : '{count} members', { count }),
  ]
    .filter(Boolean)
    .join(' · ');
  const content = (
    <>
      <View style={s.avatar}>
        <Text style={s.initial}>{Array.from(group.name)[0]?.toLocaleUpperCase(language)}</Text>
      </View>
      <View style={s.info}>
        <Text style={s.name}>{group.name}</Text>
        {(!!group.creatorName || !!date) && (
          <Text style={s.meta}>
            {group.creatorName
              ? t('Created by {name}', { name: group.creatorName })
              : t('Creator unavailable')}
          </Text>
        )}
        {!!details && <Text style={s.meta}>{details}</Text>}
        {!details && !group.creatorName && !onJoin && !onToggle && (
          <Text style={s.meta}>{t('Group details unavailable')}</Text>
        )}
      </View>
    </>
  );
  if (onToggle)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={s.row}
      >
        {content}
        <View accessible={false} style={[s.chevron, expanded && s.chevronOpen]} />
      </Pressable>
    );
  return (
    <View style={s.row}>
      {content}
      {onJoin && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Join {name}', { name: group.name })}
          accessibilityState={{ disabled, busy: joining }}
          disabled={disabled}
          onPress={onJoin}
          style={({ pressed }) => [s.join, (pressed || (disabled && !joining)) && s.muted]}
        >
          {joining ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={s.symbol}
            >
              <View style={s.door} />
              <View style={s.shaft} />
              <View style={s.tip} />
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#BCB5FF20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: colors.accent, fontSize: 20, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  name: { color: colors.text, fontWeight: '600', fontSize: 16 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  chevron: {
    width: 9,
    height: 9,
    marginHorizontal: 9,
    borderRightWidth: 1.8,
    borderBottomWidth: 1.8,
    borderColor: colors.accent,
    transform: [{ rotate: '45deg' }],
  },
  chevronOpen: { transform: [{ rotate: '225deg' }] },
  join: {
    height: 44,
    width: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BCB5FF20',
  },
  muted: { opacity: 0.55 },
  symbol: { width: 23, height: 22 },
  door: {
    position: 'absolute',
    right: 0,
    top: 1,
    width: 10,
    height: 20,
    borderColor: colors.accent,
    borderWidth: 2,
    borderLeftWidth: 0,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  shaft: {
    position: 'absolute',
    left: 0,
    top: 10,
    width: 14,
    height: 2,
    backgroundColor: colors.accent,
  },
  tip: {
    position: 'absolute',
    left: 7,
    top: 7,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.accent,
    transform: [{ rotate: '45deg' }],
  },
});
