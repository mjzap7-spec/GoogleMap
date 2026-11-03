import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { colors } from '../../../shared/theme/colors';
import { Feedback } from '../../../shared/ui/Feedback';
import { HomeDropdown } from './components/HomeDropdown';
import { ContactsPanel, type ContactsPanelProps } from '../../contacts/views/ContactsPanel';
import { MapCanvas } from '../../map/views/MapCanvas';
import type { MapCanvasProps } from '../../map/models/map';

export function HomeView({
  error,
  contacts,
  map,
}: {
  error: string;
  contacts: ContactsPanelProps;
  map: MapCanvasProps;
}) {
  const { t } = useTranslation();

  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const closeContacts = () => {
    Keyboard.dismiss();
    setContactsOpen(false);
  };
  const [contactsOpen, setContactsOpen] = useState(false);
  const [tabWidth, setTabWidth] = useState(0);
  const [tabProgress] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!contactsOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setContactsOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [contactsOpen]);
  useEffect(() => {
    const animation = Animated.timing(tabProgress, {
      toValue: contactsOpen ? 1 : 0,
      duration: reducedMotion !== false ? 0 : 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [contactsOpen, reducedMotion, tabProgress]);
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {contactsOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Close dropdown')}
          onPress={closeContacts}
          style={styles.dismiss}
        />
      )}
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <View style={styles.headerContent}>
          <View
            style={styles.tabs}
            onLayout={(event) =>
              setTabWidth(Math.max(0, (event.nativeEvent.layout.width - 14) / 2))
            }
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tabIndicator,
                {
                  width: tabWidth,
                  transform: [
                    {
                      translateX: tabProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, tabWidth + 4],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Map')}
              accessibilityState={{ selected: !contactsOpen }}
              onPress={closeContacts}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Text style={[styles.tabText, !contactsOpen && styles.selectedText]}>{t('Map')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Contacts')}
              accessibilityState={{ selected: contactsOpen, expanded: contactsOpen }}
              onPress={() => {
                if (contactsOpen) closeContacts();
                else setContactsOpen(true);
              }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Text style={[styles.tabText, contactsOpen && styles.selectedText]}>
                {t('Contacts')}
              </Text>
              <View
                accessible={false}
                style={[styles.chevron, contactsOpen && styles.selectedChevron]}
              />
            </Pressable>
          </View>
          <HomeDropdown open={contactsOpen} style={styles.contactsDropdown}>
            <ContactsPanel
              listHeight={Math.max(100, Math.min(360, height - insets.top - insets.bottom - 330))}
              {...contacts}
              onEdit={(contact) => {
                closeContacts();
                contacts.onEdit(contact);
              }}
              onSelect={(contact) => {
                closeContacts();
                contacts.onSelect(contact);
              }}
            />
          </HomeDropdown>
        </View>
        <View style={styles.sharingRow}>
          <Text style={[styles.sharingTitle, { flex: 1, flexShrink: 1 }]}>
            {t('Show Nearby Users')}
          </Text>
          <Switch
            accessibilityLabel={t('Show Nearby Users')}
            accessibilityHint={t('Show signed-in users within 5 km.')}
            thumbColor={contacts.state.showNearby ? colors.accent : colors.muted}
            value={contacts.state.showNearby}
            onValueChange={contacts.commands.setShowNearby}
            disabled={
              (!map.state.live || map.state.tracking !== 'tracking') && !contacts.state.showNearby
            }
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>
        {contacts.state.showNearby &&
          !!(contacts.state.nearbyError || contacts.state.sharingError) && (
            <Pressable
              accessibilityRole="button"
              onPress={contacts.commands.retryNearby}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: colors.accent }}>
                {t('Nearby unavailable')} · {t('Retry')}
              </Text>
            </Pressable>
          )}
      </View>
      <View style={styles.mapArea}>
        <MapCanvas {...map} />
      </View>
      <View pointerEvents="none" style={styles.feedback}>
        <Feedback
          error={
            error ||
            (contacts.state.formOpen || contacts.state.inboxOpen ? '' : contacts.state.error) ||
            (contacts.state.showNearby ? contacts.state.nearbyError : '') ||
            contacts.state.sharingError
          }
          notice={contacts.state.notice}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  sharingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  sharingTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sharingHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  requestsButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 28, paddingBottom: 16, zIndex: 4 },
  headerContent: { zIndex: 2, width: '100%', maxWidth: 360, alignSelf: 'center' },
  tabs: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 17,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  tabText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  selectedText: { color: colors.buttonText },
  chevron: {
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.muted,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
  },
  selectedChevron: {
    borderColor: colors.buttonText,
    transform: [{ rotate: '225deg' }],
    marginTop: 4,
  },
  pressed: { opacity: 0.75 },
  contactsDropdown: {
    position: 'absolute',
    top: 65,
    left: 0,
    right: 0,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  mapArea: { flex: 1, zIndex: 0 },
  dismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 3 },
  feedback: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    zIndex: 2,
    maxWidth: 380,
    alignSelf: 'center',
  },
});
