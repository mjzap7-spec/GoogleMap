import { useTranslation } from '../i18n/LanguageProvider';
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { clampDate, formatDateOnly, parseDateOnly } from '../utils/dateOnly';
import type { DateFieldProps } from './DateField.types';
import { ui } from './styles';

export function DateField({
  label,
  value,
  onChange,
  disabled = false,
  minimumDate,
  maximumDate,
  initialDate,
}: DateFieldProps) {
  const { t } = useTranslation();

  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const pickerOpen = useRef(false);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(() => parseDateOnly(value, initialDate ?? maximumDate));

  useEffect(
    () => () => {
      if (Platform.OS === 'android' && pickerOpen.current) {
        void DateTimePickerAndroid.dismiss('date').catch(() => {});
      }
    },
    [],
  );

  function closePicker() {
    pickerOpen.current = false;
    setVisible(false);
  }

  function openPicker() {
    if (disabled || pickerOpen.current) return;
    input.current?.blur();
    Keyboard.dismiss();
    pickerOpen.current = true;
    const selected = clampDate(
      parseDateOnly(value, initialDate ?? maximumDate),
      minimumDate,
      maximumDate,
    );
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selected,
        mode: 'date',
        display: 'calendar',
        minimumDate,
        maximumDate,
        onValueChange: (_event, date) => {
          pickerOpen.current = false;
          onChange(formatDateOnly(date));
        },
        onDismiss: () => {
          pickerOpen.current = false;
        },
      });
    } else {
      setDraft(selected);
      setVisible(true);
    }
  }

  return (
    <>
      <Text style={ui.label}>{t(label)}</Text>
      <View>
        <TextInput
          ref={input}
          accessibilityLabel={t(label)}
          accessibilityHint={t('Opens a calendar to choose your birthday')}
          value={value}
          placeholder={t('Select date')}
          placeholderTextColor={colors.placeholder}
          style={[ui.input, { paddingRight: 58 }]}
          editable={!disabled}
          showSoftInputOnFocus={false}
          caretHidden
          onFocus={openPicker}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Opens a calendar to choose your birthday')}
          disabled={disabled}
          onPress={openPicker}
          style={styles.calendarButton}
        >
          <Text style={styles.calendarIcon}>▦</Text>
        </Pressable>
      </View>
      {Platform.OS === 'ios' && (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={closePicker}>
          <View style={styles.backdrop}>
            <View accessibilityViewIsModal style={styles.dialog}>
              <Text accessibilityRole="header" style={ui.label}>
                {t(label)}
              </Text>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                themeVariant="dark"
                accentColor={colors.accent}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onValueChange={(_event, date) => setDraft(date)}
              />
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={closePicker} style={styles.action}>
                  <Text style={ui.muted}>{t('Cancel')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(formatDateOnly(draft));
                    closePicker();
                  }}
                  style={styles.action}
                >
                  <Text style={ui.link}>{t('Done')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  calendarButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarIcon: { color: colors.accent, fontSize: 24 },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    padding: 18,
    backgroundColor: colors.input,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  action: { minHeight: 44, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
});
