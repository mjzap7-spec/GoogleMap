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
  const details = !!date || count != null;
  const content = (
    <>
      <View style={s.avatar}>
        <Text style={s.initial}>{Array.from(group.name)[0]?.toLocaleUpperCase(language)}</Text>
      </View>
      <View style={s.info}>
        <Text numberOfLines={2} style={s.name}>
          {group.name}
        </Text>
        {(!!group.creatorName || !!date) && (
          <Text numberOfLines={1} style={s.meta}>
            {group.creatorName
              ? t('Created by {name}', { name: group.creatorName })
              : t('Creator unavailable')}
          </Text>
        )}
        {details && (
          <View style={s.details}>
            {count != null && (
              <Text style={s.memberCount}>
                {t(count === 1 ? '1 member' : '{count} members', { count })}
              </Text>
            )}
            {!!date && <Text style={s.date}>{date}</Text>}
          </View>
        )}
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
        style={({ pressed }) => [s.row, pressed && s.muted]}
      >
        {content}
        <View accessible={false} style={[s.disclosure, expanded && s.disclosureOpen]}>
          <View style={[s.chevron, expanded && s.chevronOpen]} />
        </View>
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
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#BCB5FF20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: colors.accent, fontSize: 20, fontWeight: '700' },
  info: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: colors.text, fontWeight: '700', fontSize: 16 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  details: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 3 },
  memberCount: {
    color: '#D1CCF2',
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#BCB5FF0E',
    borderRadius: 6,
    overflow: 'hidden',
  },
  date: { color: colors.placeholder, fontSize: 11, lineHeight: 17 },
  disclosure: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF05',
  },
  disclosureOpen: { backgroundColor: '#BCB5FF15' },
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
