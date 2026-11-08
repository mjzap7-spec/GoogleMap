import React from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { useMessageArrival, useChatProgress, useChatPress } from './chatMotion';
import { DeleteIcon } from './ChatSheet';
import { EditIcon } from '../../../shared/ui/ChatIcon';
import { SelectionCheck } from './SelectionCheck';
export function MessageSelectionBar({
  count,
  busy,
  selectingAll,
  allSelected,
  onCancel,
  onSelectAll,
  onDelete,
  onReply,
  onEdit,
}: {
  count: number;
  busy: boolean;
  selectingAll: boolean;
  allSelected: boolean;
  onCancel: () => void;
  onSelectAll: () => void;
  onDelete: () => void;
  onReply?: () => void;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  const motion = useMessageArrival(true);
  return (
    <Animated.View style={[s.bar, motion]}>
      <ToolbarButton label={t('Cancel selection')} onPress={onCancel} disabled={busy}>
        <View accessible={false} style={s.close}>
          <View style={[s.closeLine, s.closeForward]} />
          <View style={[s.closeLine, s.closeBackward]} />
        </View>
      </ToolbarButton>
      <View style={s.count}>
        <Text
          accessibilityLabel={t('{count} selected', { count })}
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          style={s.title}
        >
          {t('{count} selected', { count })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={t(
          selectingAll
            ? 'Cancel selection'
            : allSelected
              ? 'Deselect all messages'
              : 'Select all messages',
        )}
        accessibilityState={{
          disabled: busy,
          checked: allSelected ? true : count > 0 ? 'mixed' : false,
          busy: selectingAll,
        }}
        onPress={onSelectAll}
        disabled={busy}
        style={({ pressed }) => [s.icon, busy && s.dim, pressed && s.pressed]}
      >
        {selectingAll ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <SelectionCheck checked={allSelected} mixed={count > 0} />
        )}
      </Pressable>
      <View style={s.divider} />
      <SelectionAction
        visible={count === 1 && !!onReply}
        label={t('Reply')}
        disabled={busy || selectingAll}
        onPress={onReply}
      >
        <View accessible={false} style={s.reply}>
          <View style={s.replyArrow} />
        </View>
      </SelectionAction>
      <SelectionAction
        visible={count === 1 && !!onEdit}
        label={t('Edit message')}
        disabled={busy || selectingAll}
        onPress={onEdit}
      >
        <EditIcon />
      </SelectionAction>
      <ToolbarButton
        label={t('Delete for me')}
        disabled={!count || busy || selectingAll}
        onPress={onDelete}
        danger
      >
        {busy ? <ActivityIndicator color="#FFB4BE" /> : <DeleteIcon />}
      </ToolbarButton>
    </Animated.View>
  );
}
function SelectionAction({
  visible,
  label,
  disabled,
  onPress,
  children,
}: {
  visible: boolean;
  label: string;
  disabled: boolean;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  // Only these two small toolbar slots animate layout; message rows stay on the native driver.
  const progress = useChatProgress(visible ? 1 : 0, 160, false);
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[
        s.actionSlot,
        {
          width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 48] }),
          opacity: progress,
        },
      ]}
    >
      <ToolbarButton label={label} disabled={disabled || !visible} onPress={onPress}>
        {children}
      </ToolbarButton>
    </Animated.View>
  );
}
function ToolbarButton({
  label,
  disabled,
  onPress,
  danger = false,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress?: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const press = useChatPress();
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [
          s.icon,
          danger && s.danger,
          disabled && s.dim,
          pressed && s.pressed,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    padding: 6,
    borderRadius: 18,
    backgroundColor: '#1C1F2A',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BCB5FF30',
  },
  icon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actionSlot: { overflow: 'hidden' },
  divider: { width: 1, height: 22, backgroundColor: '#BCB5FF22', marginHorizontal: 5 },
  count: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
  },
  close: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  closeLine: {
    position: 'absolute',
    width: 17,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  closeForward: { transform: [{ rotate: '45deg' }] },
  closeBackward: { transform: [{ rotate: '-45deg' }] },
  danger: { backgroundColor: '#FFB4BE0D' },
  reply: {
    width: 20,
    height: 14,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.accent,
    borderTopRightRadius: 9,
    marginTop: 5,
  },
  replyArrow: {
    position: 'absolute',
    top: -6,
    left: 0,
    width: 9,
    height: 9,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.accent,
    transform: [{ rotate: '45deg' }],
  },
  pressed: { backgroundColor: '#BCB5FF20' },
  dim: { opacity: 0.35 },
});
