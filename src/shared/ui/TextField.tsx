import { useTranslation } from '../i18n/LanguageProvider';
import React, { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { colors } from '../theme/colors';
import { ui } from './styles';

/** Only focus styling lives here. Values and validation belong to the feature ViewModel. */
export function TextField({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...props}
      placeholder={props.placeholder ? t(props.placeholder) : undefined}
      accessibilityLabel={props.accessibilityLabel ? t(props.accessibilityLabel) : undefined}
      placeholderTextColor={colors.placeholder}
      keyboardAppearance="dark"
      selectionColor={colors.accent}
      style={[ui.input, focused && ui.inputFocused, style]}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
}
