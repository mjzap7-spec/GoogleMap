import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { colors } from '../../../shared/theme/colors';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
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
      <ScreenHeader onBack={onBack} title={t('Contacts')} />
      <View style={styles.body}>
        <View style={styles.tabs}>
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: 'contacts', label: t('Contacts') },
              {
                value: 'groups',
                label: t('Private groups') + (invitations > 0 ? ' · ' + invitations : ''),
              },
            ]}
          />
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
  tabs: { marginBottom: 14 },
  screen: { flex: 1, backgroundColor: colors.background },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  panel: {
    flex: 1,
    minHeight: 0,
    marginBottom: 12,
  },
});
