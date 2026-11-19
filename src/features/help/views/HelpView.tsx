import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { PhoneIcon } from '../../interviews/views/CallIcon';
import { ChatIcon, InboxIcon } from '../../../shared/ui/ChatIcon';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { SearchField } from '../../../shared/ui/SearchField';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { colors } from '../../../shared/theme/colors';

import { topics } from '../models/helpTopics';

const pinStyles = StyleSheet.create({
  pin: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderBottomRightRadius: 2,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  pinCenter: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
});

const shortcuts = [
  { title: 'Chats', icon: <ChatIcon unread={0} /> },
  { title: 'Unread messages', icon: <InboxIcon /> },
  { title: 'Interview calls', icon: <PhoneIcon /> },
  {
    title: 'Location sharing',
    icon: (
      <View style={pinStyles.pin}>
        <View style={pinStyles.pinCenter} />
      </View>
    ),
  },
] as const;
const Topic = memo(function Topic({
  id,
  title,
  body,
  open,
  onPress,
  onPosition,
}: {
  id: string;
  title: string;
  body: string;
  open: boolean;
  onPress: (id: string) => void;
  onPosition?: (id: string, y: number) => void;
}) {
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [height] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();
  const previousOpen = useRef(open);
  useEffect(() => {
    const changed = previousOpen.current !== open;
    previousOpen.current = open;
    if (!changed || reducedMotion !== false) {
      height.setValue(open ? measuredHeight : 0);
      return;
    }
    const animation = Animated.timing(height, {
      toValue: open ? measuredHeight : 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [open, measuredHeight, height, reducedMotion]);
  return (
    <View
      onLayout={onPosition ? (event) => onPosition(id, event.nativeEvent.layout.y) : undefined}
      style={[styles.card, open && styles.openCard]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => onPress(id)}
        style={({ pressed }) => [styles.topicHeader, pressed && styles.pressed]}
      >
        <Text style={styles.heading}>{title}</Text>
        <View accessible={false} style={[styles.disclosure, open && styles.openDisclosure]}>
          <View style={[styles.chevron, open && styles.openChevron]} />
        </View>
      </Pressable>
      <Animated.View
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        aria-hidden={!open}
        style={{ height, overflow: 'hidden' }}
      >
        <View
          onLayout={(event) => setMeasuredHeight(event.nativeEvent.layout.height)}
          style={styles.answer}
        >
          <Text style={styles.body}>{body}</Text>
        </View>
      </Animated.View>
    </View>
  );
});
export function HelpView({ onBack, topic }: { onBack: () => void; topic?: string }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState<string | null>();
  const search = useDeferredValue(query.trim().toLocaleLowerCase());
  const initial = topics.find(([title]) => title === topic)?.[0] ?? topics[0][0];
  const [expanded, setExpanded] = useState<string | null>(initial);
  const scroll = useRef<ScrollViewInstance>(null);
  const pendingTopic = useRef(topic ? initial : undefined);
  const positions = useRef(new Map<string, number>());
  const reveal = useCallback(() => {
    const id = pendingTopic.current;
    const y = id ? positions.current.get(id) : undefined;
    if (y === undefined || !scroll.current) return;
    pendingTopic.current = undefined;
    scroll.current.scrollTo({ y: Math.max(0, y - 4), animated: false });
  }, []);
  const recordPosition = useCallback(
    (id: string, y: number) => {
      positions.current.set(id, y);
      if (pendingTopic.current === id) reveal();
    },
    [reveal],
  );
  const takeControl = useCallback(() => {
    pendingTopic.current = undefined;
  }, []);
  const translatedTopics = useMemo(
    () =>
      topics.map(([title, body]) => ({
        id: title,
        title: t(title),
        body: t(body),
        search: (t(title) + ' ' + t(body)).toLocaleLowerCase(),
      })),
    [t],
  );
  const filtered = useMemo(
    () => translatedTopics.filter((item) => item.search.includes(search)),
    [translatedTopics, search],
  );
  const singleResult = search && filtered.length === 1 ? filtered[0].id : undefined;
  const toggle = useCallback(
    (id: string) => {
      takeControl();
      if (search) {
        setSearchExpanded((current) =>
          (current === undefined ? singleResult : current) === id ? null : id,
        );
      } else {
        setExpanded((current) => (current === id ? null : id));
      }
    },
    [takeControl, search, singleResult],
  );
  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('Help')} onBack={onBack} />
      <View style={styles.search}>
        <SearchField
          accessibilityLabel={t('Search help')}
          placeholder={t('Search help')}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setSearchExpanded(undefined);
            scroll.current?.scrollTo({ y: 0, animated: false });
          }}
          onFocus={takeControl}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <ScrollView
        ref={scroll}
        onContentSizeChange={reveal}
        onScrollBeginDrag={takeControl}
        onTouchStart={takeControl}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {!search && (
          <View style={styles.shortcuts}>
            {shortcuts.map(({ title: id, icon }) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                onPress={() => {
                  takeControl();
                  setExpanded(id);
                  const y = positions.current.get(id);
                  if (y !== undefined)
                    scroll.current?.scrollTo({
                      y: Math.max(0, y - 4),
                      animated: reducedMotion === false,
                    });
                }}
                style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
              >
                <View accessible={false} style={styles.shortcutIcon}>
                  {icon}
                </View>
                <Text style={styles.shortcutText}>{t(id)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {filtered.map(({ id, title, body }) => (
          <Topic
            key={id}
            id={id}
            title={title}
            body={body}
            open={
              search
                ? searchExpanded === id || (searchExpanded === undefined && singleResult === id)
                : expanded === id
            }
            onPosition={search ? undefined : recordPosition}
            onPress={toggle}
          />
        ))}
        {!filtered.length && (
          <View style={styles.empty}>
            <Text style={styles.body}>
              {t('No matching help topics. Try location, contacts, or trips.')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setQuery('')}
              style={styles.clearSearch}
            >
              <Text style={styles.shortcutText}>{t('Clear search')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  search: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 4,
    gap: 8,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  shortcut: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: '#BCB5FF14',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BCB5FF2D',
  },
  shortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BCB5FF19',
    flexShrink: 0,
  },
  shortcutText: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  clearSearch: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#BCB5FF22',
  },
  pressed: { backgroundColor: '#BCB5FF30' },
  empty: { backgroundColor: colors.input, borderRadius: 18, padding: 16, gap: 12 },
  openCard: { borderColor: '#BCB5FF80', backgroundColor: '#1C1D29' },
  card: {
    borderRadius: 18,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 17,
  },
  heading: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  disclosure: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BCB5FF0D',
  },
  openDisclosure: { backgroundColor: '#BCB5FF24' },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.accent,
    transform: [{ rotate: '45deg' }],
    marginTop: -3,
  },
  openChevron: { transform: [{ rotate: '225deg' }], marginTop: 3 },
  answer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
});
