import React, { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { Avatar } from '../../../shared/ui/Avatar';
import { EditIcon } from '../../../shared/ui/ChatIcon';
import { UnreadBadge } from '../../../shared/ui/UnreadBadge';
import { ContactQuickActions } from './ContactQuickActions';
import type { useContactRowActions } from './useContactRowActions';

/** Primitive display props isolate unrelated live updates from visible contact rows. */
export const ContactRow = memo(function ContactRow({
  id,
  name,
  avatarUrl,
  unread,
  canChat,
  canCall,
  locating,
  disabled,
  card,
  actions,
}: {
  id: string;
  name: string;
  avatarUrl?: string | null;
  unread: number;
  canChat: boolean;
  canCall: boolean;
  locating: boolean;
  disabled: boolean;
  card: boolean;
  actions: ReturnType<typeof useContactRowActions>;
}) {
  const { t } = useTranslation();
  return (
    <View style={[s.row, card && s.card]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Show {name} on map', { name })}
        accessibilityState={{ disabled, busy: locating }}
        onPress={() => actions.select(id)}
        disabled={disabled}
        style={({ pressed }) => [s.person, pressed && s.pressed]}
      >
        <View>
          <Avatar uri={avatarUrl} name={name} size={card ? 44 : 40} />
          <UnreadBadge count={unread} />
        </View>
        <Text style={s.name} numberOfLines={2}>
          {name}
        </Text>
        {locating && <ActivityIndicator color={colors.accent} size="small" />}
      </Pressable>
      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Edit {name}', { name })}
          onPress={() => actions.edit(id)}
          style={({ pressed }) => [s.button, pressed && s.pressed]}
        >
          <EditIcon />
        </Pressable>
        <ContactQuickActions
          name={name}
          unread={unread}
          onCall={canCall ? () => actions.call(id) : undefined}
          onChat={() => actions.chat(id)}
          chatDisabled={!canChat}
        />
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: '#282B36',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  person: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
  },
  name: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  button: {
    borderRadius: 13,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7, backgroundColor: '#BCB5FF16' },
});
