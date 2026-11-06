import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  appLanguages as mapLanguages,
  type AppLanguage as MapLanguage,
} from '../../../shared/i18n/languages';
import { colors } from '../../../shared/theme/colors';

export function MapLanguageSettings({
  language,
  onChange,
}: {
  language: MapLanguage;
  onChange: (language: MapLanguage) => void;
}) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {t('Language')}
      </Text>
      <Text style={styles.label}>{t('App language')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Change app language')}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}
      >
        <Text style={styles.text}>
          {mapLanguages.find((item) => item.code === language)?.label}
        </Text>
        <Text style={styles.accent}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && (
        <View style={styles.options}>
          {mapLanguages.map((item) => (
            <Pressable
              key={item.code}
              accessibilityRole="button"
              accessibilityState={{ selected: item.code === language }}
              onPress={() => {
                onChange(item.code);
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.option,
                item.code === language && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.text}>{item.label}</Text>
              {item.code === language && <Text style={styles.accent}>✓</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: '#14161D',
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 12 },
  selected: { backgroundColor: '#BCB5FF12' },
  label: { color: colors.text, fontSize: 14, marginBottom: 10 },
  field: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  options: {
    marginTop: 8,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  option: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: { color: colors.text, fontSize: 15 },
  accent: { color: colors.accent, fontSize: 18 },
  pressed: { opacity: 0.65 },
});
