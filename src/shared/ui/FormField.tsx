import { useTranslation } from '../i18n/LanguageProvider';
import React, { type ReactNode } from 'react';
import { Text, View, type TextInputProps } from 'react-native';
import { TextField } from './TextField';
import { ui } from './styles';

export function FormField({
  label,
  labelAccessory,
  ...props
}: TextInputProps & { label: string; labelAccessory?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <>
      {labelAccessory ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <Text style={[ui.label, { marginBottom: 0 }]}>{t(label)}</Text>
          {labelAccessory}
        </View>
      ) : (
        <Text style={ui.label}>{t(label)}</Text>
      )}
      <TextField accessibilityLabel={t(label)} {...props} />
    </>
  );
}
