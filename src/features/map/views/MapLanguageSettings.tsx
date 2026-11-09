import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  appLanguages as mapLanguages,
  type AppLanguage as MapLanguage,
} from '../../../shared/i18n/languages';
import { SettingsSection, SettingsSymbol } from '../../../shared/ui/SettingsSection';
import { colors } from '../../../shared/theme/colors';

export function MapLanguageSettings({
  language,
  onChange,
}: {
  language: MapLanguage;
  onChange: (language: MapLanguage) => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsSection
      title={t('Language')}
      value={mapLanguages.find((item) => item.code === language)?.label}
      label={t('Change app language')}
      icon={<SettingsSymbol kind="language" />}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('App language')}
        style={styles.options}
      >
        {mapLanguages.map((item) => (
          <Pressable
            key={item.code}
            accessibilityRole="radio"
            accessibilityLabel={item.label}
            accessibilityState={{ checked: item.code === language }}
            onPress={() => onChange(item.code)}
            style={({ pressed }) => [
              styles.option,
              item.code === language && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.text}>{item.label}</Text>
            <View style={[styles.radio, item.code === language && styles.selectedRadio]}>
              {item.code === language && <View style={styles.dot} />}
            </View>
          </Pressable>
        ))}
      </View>
    </SettingsSection>
  );
}
const styles = StyleSheet.create({
  options: { gap: 4 },
  option: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
  },
  selected: { backgroundColor: '#BCB5FF14' },
  text: { color: colors.text, fontSize: 15 },
  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRadio: { borderColor: colors.accent },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  pressed: { opacity: 0.7 },
});
