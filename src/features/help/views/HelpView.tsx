import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../../shared/ui/BackButton';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';

const topics = [
  [
    'Show Nearby Users',
    'Turn on Show Nearby Users to see signed-in users within 5 km. They do not need to enable the switch.',
  ],
  ['Contacts', 'Choose a saved contact to center the map on their latest available GPS position.'],
  [
    'Recording',
    'Tap the center button to start or pause your path. Use Clear path to remove the recorded line.',
  ],
  ['Settings', 'Update your profile, password, and language in Settings.'],
  [
    'Your location',
    'While you are signed in and the app is open, your GPS location is visible to nearby users. Location permission is required.',
    'Location sharing pauses in the background and when you sign out. Offline locations disappear after a short delay.',
  ],
];
export function HelpView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
    >
      <BackButton onPress={onBack} />
      <Text accessibilityRole="header" style={styles.title}>
        {t('Help')}
      </Text>
      {topics.map(([title, ...paragraphs]) => (
        <View key={title} style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            {t(title)}
          </Text>
          {paragraphs.map((paragraph) => (
            <Text key={paragraph} style={styles.body}>
              {t(paragraph)}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 24, gap: 14 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', marginBottom: 8 },
  card: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  heading: { color: colors.text, fontSize: 17, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
});
