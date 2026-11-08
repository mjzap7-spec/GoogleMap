import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
  Switch,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../shared/theme/colors';
import { ContactsIcon } from '../../../shared/ui/ContactsIcon';
import { Feedback } from '../../../shared/ui/Feedback';
import { HomeDropdown } from './components/HomeDropdown';
import { ContactsPanel, type ContactsPanelProps } from '../../contacts/views/ContactsPanel';
import { MapCanvas } from '../../map/views/MapCanvas';
import { MapPeoplePicker } from '../../map/views/MapPeoplePicker';
import type { MapCanvasProps, MapUserMarker } from '../../map/models/map';
import type { MapPeopleFilter } from '../../map/models/mapPeople';

export function HomeView({
  testCount = 0,
  onStopTesting,
  tripGroup,
  onStopTrip,
  onFollowTrip,
  error,
  contacts,
  map,
  peopleFilter,
  onPeopleFilter,
}: {
  testCount?: number;
  onStopTesting?: () => void;
  tripGroup?: string;
  onStopTrip?: () => void;
  onFollowTrip: (id: string) => void;
  error: string;
  contacts: ContactsPanelProps;
  map: MapCanvasProps;
  peopleFilter: MapPeopleFilter;
  onPeopleFilter: (value: MapPeopleFilter) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mapHeight, setMapHeight] = useState(height);
  const [contactsOpen, setContactsOpen] = useState(false);
  const trips = useMemo(
    () =>
      (map.users ?? [])
        .filter((user) => user.trip)
        .sort((a, b) => a.nickname.localeCompare(b.nickname) || a.id.localeCompare(b.id)),
    [map.users],
  );
  const closeContacts = () => {
    Keyboard.dismiss();
    setContactsOpen(false);
  };
  useEffect(() => {
    if (!contactsOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setContactsOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [contactsOpen]);
  const nearbyFailed =
    contacts.state.showNearby && !!(contacts.state.nearbyError || contacts.state.sharingError);
  return (
    <View style={styles.screen} onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFill}>
        <MapCanvas {...map} />
      </View>
      {contactsOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Close dropdown')}
          onPress={closeContacts}
          style={styles.dismiss}
        />
      )}
      <View
        pointerEvents="box-none"
        style={[
          styles.header,
          { top: insets.top + 12, left: insets.left + 16, right: insets.right + 16 },
        ]}
      >
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Map')}
            accessibilityState={{ selected: !contactsOpen }}
            onPress={closeContacts}
            style={({ pressed }) => [styles.mapPill, pressed && styles.pressed]}
          >
            <View style={styles.mapDot}>
              <View style={styles.mapDotCenter} />
            </View>
            <Text style={styles.mapTitle} numberOfLines={1}>
              {t('Map')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Contacts')}
            accessibilityState={{ expanded: contactsOpen }}
            onPress={() => (contactsOpen ? closeContacts() : setContactsOpen(true))}
            style={({ pressed }) => [
              styles.contactsPill,
              contactsOpen && styles.activePill,
              pressed && styles.pressed,
            ]}
          >
            <ContactsIcon />
            <Text style={styles.buttonText} numberOfLines={1}>
              {t('Contacts')}
            </Text>
            <View accessible={false} style={[styles.chevron, contactsOpen && styles.chevronOpen]} />
          </Pressable>
        </View>
        <View pointerEvents="box-none" style={styles.nearbyRow}>
          <View style={styles.nearbyPill}>
            <View
              accessible={false}
              style={[styles.presenceDot, contacts.state.showNearby && styles.presenceOn]}
            />
            <Text style={styles.nearbyText}>{t('Show people')}</Text>
            <Switch
              accessibilityLabel={t('Show people')}
              accessibilityHint={t(
                'Show people who share with you. This does not share your location.',
              )}
              thumbColor={contacts.state.showNearby ? colors.accent : colors.muted}
              value={contacts.state.showNearby}
              onValueChange={contacts.commands.setShowNearby}
              trackColor={{ false: colors.border, true: '#675E9A' }}
            />
          </View>
          {trips.length > 0 && <LiveTripButton trips={trips} onFollow={onFollowTrip} />}
        </View>
        {contacts.state.showNearby && !testCount && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filters}
            contentContainerStyle={styles.filterContent}
          >
            {(['all', 'contacts', 'groups', 'nearby'] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: value === peopleFilter }}
                accessibilityLabel={t(
                  value === 'all'
                    ? 'All people'
                    : value === 'contacts'
                      ? 'Contacts on map'
                      : value === 'groups'
                        ? 'Group members on map'
                        : 'Nearby users on map',
                )}
                onPress={() => onPeopleFilter(value)}
                style={({ pressed }) => [
                  styles.filter,
                  value === peopleFilter && styles.activePill,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.nearbyText}>
                  {t(
                    value === 'all'
                      ? 'All'
                      : value === 'contacts'
                        ? 'Contacts'
                        : value === 'groups'
                          ? 'Groups'
                          : 'Nearby',
                  )}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {nearbyFailed && (
          <Pressable
            accessibilityRole="button"
            onPress={contacts.commands.retryNearby}
            style={styles.retry}
          >
            <Text style={styles.retryText}>
              {t('Nearby unavailable')} · {t('Retry')}
            </Text>
          </Pressable>
        )}
        {!!testCount && (
          <View style={styles.tripBanner}>
            <Text style={styles.tripText}>{t('{count} test users', { count: testCount })}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Stop testing')}
              onPress={onStopTesting}
              style={styles.stopTrip}
            >
              <Text style={styles.retryText}>{t('Stop')}</Text>
            </Pressable>
          </View>
        )}
        {!!tripGroup && (
          <View style={styles.tripBanner}>
            <Text style={styles.tripText}>
              {t('Sharing trip')} · {tripGroup}
            </Text>
            <Pressable accessibilityRole="button" onPress={onStopTrip} style={styles.stopTrip}>
              <Text style={styles.retryText}>{t('Stop')}</Text>
            </Pressable>
          </View>
        )}
        <HomeDropdown
          open={contactsOpen}
          style={[styles.contactsDropdown, { maxHeight: Math.max(0, mapHeight - insets.top - 72) }]}
        >
          <View accessible={false} style={styles.handle} />
          <ContactsPanel
            {...contacts}
            listHeight={Math.max(68, Math.min(260, height - insets.top - insets.bottom - 440))}
            onChat={(contact) => {
              closeContacts();
              contacts.onChat(contact);
            }}
            onShowAll={() => {
              closeContacts();
              contacts.onShowAll?.();
            }}
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
      <Feedback
        source="map"
        error={
          error ||
          (contacts.state.showNearby ? contacts.state.nearbyError : '') ||
          contacts.state.sharingError
        }
      />
    </View>
  );
}
function LiveTripButton({
  trips,
  onFollow,
}: {
  trips: MapUserMarker[];
  onFollow: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label =
    trips.length === 1
      ? t('Follow {name}', { name: trips[0].nickname })
      : t('Live trips') + ' · ' + trips.length;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => (trips.length === 1 ? onFollow(trips[0].id) : setOpen(true))}
        style={({ pressed }) => [styles.liveTrips, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={styles.nearbyText}>
          {label}
        </Text>
      </Pressable>
      {open && (
        <MapPeoplePicker
          users={trips}
          open
          title={t('Live trips')}
          onClose={() => setOpen(false)}
          onSelect={(id) => {
            setOpen(false);
            onFollow(id);
          }}
        />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  filters: { flexGrow: 0, marginTop: 8, maxHeight: 44 },
  filterContent: { gap: 6 },
  filter: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: 10,
    paddingLeft: 14,
  },
  tripText: { flex: 1, color: colors.text, fontSize: 12 },
  stopTrip: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center' },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    position: 'absolute',
    // Android hit-tests children within their parent's bounds, including the open dropdown.
    bottom: 0,
    zIndex: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingRight: 52,
  },
  mapPill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 28,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 5,
  },
  mapTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  mapDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapDotCenter: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  contactsPill: {
    minHeight: 44,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 28,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 5,
  },
  activePill: { borderColor: colors.accent, backgroundColor: '#252335' },
  buttonText: { flexShrink: 1, color: colors.text, fontWeight: '600', fontSize: 14 },
  nearbyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  liveTrips: {
    maxWidth: '100%',
    flexShrink: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.input,
    paddingHorizontal: 14,
  },
  nearbyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    minHeight: 44,
    borderRadius: 24,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 3,
    maxWidth: '100%',
  },
  nearbyText: { color: colors.text, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  presenceDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.muted },
  presenceOn: { backgroundColor: colors.accent },
  chevron: {
    width: 7,
    height: 7,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.accent,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
  },
  chevronOpen: { transform: [{ rotate: '225deg' }], marginTop: 4 },
  pressed: { opacity: 0.75 },
  contactsDropdown: {
    position: 'absolute',
    top: 52,
    width: '100%',
    maxWidth: 440,
    right: 0,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 9,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: colors.input,
    borderRadius: 18,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: { color: colors.accent, fontSize: 12 },
  dismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3 },
});
