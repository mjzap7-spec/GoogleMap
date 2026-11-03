import { useTranslation } from '../i18n/LanguageProvider';
import React, { useId, useState, type CSSProperties } from 'react';
import { Text } from 'react-native';
import { colors } from '../theme/colors';
import { formatDateOnly } from '../utils/dateOnly';
import type { DateFieldProps } from './DateField.types';
import { ui } from './styles';

export function DateField({
  label,
  value,
  onChange,
  disabled = false,
  minimumDate,
  maximumDate,
}: DateFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const [focused, setFocused] = useState(false);

  function openCalendar(input: HTMLInputElement) {
    if (disabled) return;
    try {
      input.showPicker?.();
    } catch {
      /* Browsers can require a direct click; the native calendar icon remains available. */
    }
  }

  return (
    <>
      <Text nativeID={`${id}-label`} style={ui.label}>
        {t(label)}
      </Text>
      <input
        id={id}
        type="date"
        aria-labelledby={`${id}-label`}
        value={value}
        disabled={disabled}
        min={formatDateOnly(minimumDate)}
        max={formatDateOnly(maximumDate)}
        style={{
          ...inputStyle,
          ...(focused ? { borderColor: colors.accent, backgroundColor: '#1E1F2C' } : {}),
        }}
        onFocus={(event) => {
          setFocused(true);
          openCalendar(event.currentTarget);
        }}
        onClick={(event) => openCalendar(event.currentTarget)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </>
  );
}

const inputStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 56,
  padding: '16px 17px',
  marginBottom: 24,
  border: `1px solid ${colors.border}`,
  borderRadius: 14,
  backgroundColor: colors.input,
  color: colors.text,
  colorScheme: 'dark',
  fontFamily: 'inherit',
  fontSize: 16,
  outline: 'none',
};
