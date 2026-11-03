import { useTranslation } from '../../../../shared/i18n/LanguageProvider';
import React from 'react';
import { DateField } from '../../../../shared/ui/DateField';

interface BirthdayFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export function BirthdayField(props: BirthdayFieldProps) {
  const { t } = useTranslation();

  return (
    <DateField
      label={t('Birthday')}
      {...props}
      minimumDate={new Date(1900, 0, 1)}
      maximumDate={new Date()}
      initialDate={new Date(2000, 0, 1)}
    />
  );
}
