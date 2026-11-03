import { useTranslation } from '../../../../shared/i18n/LanguageProvider';
import React, { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../../shared/theme/colors';
import { useReducedMotion } from '../../../../shared/motion/useReducedMotion';

/** Source credit appears only while suggestions are displayed; no field icon. */
export function CityAttribution() {
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('About city suggestions')}
        style={styles.credit}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.info}>GeoNames / Open-Meteo</Text>
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType={reducedMotion === false ? 'fade' : 'none'}
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.card} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={styles.title}>
              {t('City suggestions')}
            </Text>
            <Text style={styles.text}>
              {t(
                'GeoNames data via Open-Meteo. Results are formatted as city, state or region, and country.',
              )}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                void Linking.openURL('https://open-meteo.com/en/docs/geocoding-api');
              }}
              style={styles.action}
            >
              <Text style={styles.link}>GeoNames via Open-Meteo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                void Linking.openURL('https://creativecommons.org/licenses/by/4.0/');
              }}
              style={styles.action}
            >
              <Text style={styles.link}>{t('CC BY 4.0 licence')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setVisible(false)}
              style={styles.action}
            >
              <Text style={styles.link}>{t('Close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  info: { color: colors.muted, fontSize: 12 },
  credit: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: 'rgba(0,0,0,0.65)' },
  card: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    borderRadius: 20,
    padding: 24,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 12 },
  text: { color: colors.muted, lineHeight: 23, fontSize: 15 },
  action: { minHeight: 44, justifyContent: 'center', marginTop: 6 },
  link: { color: colors.accent, fontSize: 15 },
});
