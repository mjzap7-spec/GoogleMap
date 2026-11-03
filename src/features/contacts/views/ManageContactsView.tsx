import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { BackButton } from '../../../shared/ui/BackButton';
import { Feedback } from '../../../shared/ui/Feedback';
import { ContactsPanel, type ContactsPanelProps } from './ContactsPanel';
export function ManageContactsView({
  contacts,
  onBack,
}: {
  contacts: ContactsPanelProps;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <BackButton onPress={onBack} />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('Contacts')}
        </Text>
        <Text style={styles.count}>{contacts.state.contacts.length}</Text>
      </View>
      <View style={styles.panel}>
        <ContactsPanel {...contacts} fill />
      </View>
      <Feedback
        error={contacts.state.formOpen || contacts.state.inboxOpen ? '' : contacts.state.error}
        notice={contacts.state.notice}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 24 },
  title: { fontSize: 30, fontWeight: '700', color: colors.text },
  count: {
    fontSize: 15,
    color: colors.accent,
    backgroundColor: '#BCB5FF18',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  panel: {
    flex: 1,
    minHeight: 0,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    marginBottom: 12,
  },
});
