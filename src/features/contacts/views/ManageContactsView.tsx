import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { ContactsPanel, type ContactsPanelProps } from './ContactsPanel';
export function ManageContactsView({
  contacts,
  onBack,
  groups,
  invitations = 0,
  tab,
  setTab,
}: {
  contacts: ContactsPanelProps;
  onBack: () => void;
  groups?: ReactNode;
  invitations?: number;
  tab: 'contacts' | 'groups';
  setTab: (tab: 'contacts' | 'groups') => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <ScreenHeader
        onBack={onBack}
        title={t('Contacts')}
        count={tab === 'contacts' ? contacts.state.contacts.length : undefined}
      />
      <View style={styles.body}>
        <View style={styles.tabs}>
          {(['contacts', 'groups'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === item }}
              onPress={() => setTab(item)}
              style={[styles.tab, tab === item && styles.selectedTab]}
            >
              <Text style={styles.tabText}>
                {t(item === 'contacts' ? 'Contacts' : 'Private groups')}
                {item === 'groups' && invitations > 0 ? ' · ' + invitations : ''}
              </Text>
            </Pressable>
          ))}
        </View>
        {tab === 'groups' ? (
          <View style={{ flex: 1 }}>{groups}</View>
        ) : (
          <View style={styles.panel}>
            <ContactsPanel {...contacts} fill />
          </View>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: colors.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTab: { borderWidth: 1, borderColor: colors.accent, backgroundColor: '#BCB5FF18' },
  tabText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  screen: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
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
