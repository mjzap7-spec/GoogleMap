import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PhoneIcon } from '../../interviews/views/CallIcon';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { ChatIcon } from '../../../shared/ui/ChatIcon';
import { chatButtonLabel } from '../../../shared/ui/UnreadBadge';

export function ContactQuickActions({
  name,
  unread,
  onCall,
  onChat,
  disabled = false,
  chatDisabled = false,
}: {
  name: string;
  unread: number;
  onCall?: () => void;
  onChat?: () => void;
  disabled?: boolean;
  chatDisabled?: boolean;
}) {
  const { t } = useTranslation();
  if (!onCall && !onChat) return null;
  return (
    <View style={s.group}>
      {onCall && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Call {name}', { name })}
          disabled={disabled}
          onPress={onCall}
          style={({ pressed }) => [s.button, s.call, pressed && s.pressed, disabled && s.disabled]}
        >
          <PhoneIcon />
        </Pressable>
      )}
      {onChat && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chatButtonLabel(t, t('Chat with {name}', { name }), unread)}
          disabled={disabled || chatDisabled}
          onPress={onChat}
          style={({ pressed }) => [
            s.button,
            pressed && s.pressed,
            (disabled || chatDisabled) && s.disabled,
          ]}
        >
          <ChatIcon unread={unread} />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    backgroundColor: '#BCB5FF0C',
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  call: { backgroundColor: '#BCB5FF14' },
  pressed: { backgroundColor: '#BCB5FF29', opacity: 0.78 },
  disabled: { opacity: 0.45 },
});
