import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { TextField } from '../../../shared/ui/TextField';
import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { colors } from '../../../shared/theme/colors';

import { topics } from '../models/helpTopics';
const Topic = memo(function Topic({
  id,
  title,
  body,
  open,
  onPress,
  onLayout,
}: {
  id: string;
  title: string;
  body: string;
  open: boolean;
  onPress: (id: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
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
    <View onLayout={onLayout} style={[styles.card, open && styles.openCard]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => onPress(id)}
        style={({ pressed }) => [styles.topicHeader, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.heading}>{title}</Text>
        <Text style={styles.chevron}>{open ? '−' : '+'}</Text>
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
  const [query, setQuery] = useState('');
  const [collapsedMatches, setCollapsedMatches] = useState<string[]>([]);
  const search = query.trim().toLocaleLowerCase();
  const initial = topics.find(([title]) => title === topic)?.[0] ?? topics[0][0];
  const [expanded, setExpanded] = useState<string | null>(initial);
  const scroll = useRef<ScrollViewInstance>(null);
  const revealOnOpen = useRef(Boolean(topic));
  const initialY = useRef<number | null>(null);
  const reveal = useCallback(() => {
    if (revealOnOpen.current && initialY.current !== null) {
      scroll.current?.scrollTo({ y: Math.max(0, initialY.current - 4), animated: false });
    }
  }, []);
  const measureInitial = useCallback(
    (event: LayoutChangeEvent) => {
      initialY.current = event.nativeEvent.layout.y;
      reveal();
    },
    [reveal],
  );
  const takeControl = useCallback(() => {
    revealOnOpen.current = false;
  }, []);
  const toggle = useCallback(
    (id: string) => {
      takeControl();
      if (search) {
        setCollapsedMatches((current) =>
          current.includes(id) ? current.filter((title) => title !== id) : [...current, id],
        );
      } else {
        setExpanded((current) => (current === id ? null : id));
      }
    },
    [takeControl, search],
  );
  const filtered = topics.filter(([title, body]) =>
    (t(title) + ' ' + t(body)).toLocaleLowerCase().includes(search),
  );
  return (
    <View style={styles.screen}>
      <ScreenHeader title={t('Help')} onBack={onBack} />
      <View style={styles.search}>
        <TextField
          accessibilityLabel={t('Search help')}
          placeholder={t('Search help')}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setCollapsedMatches([]);
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
        {filtered.map(([title, body]) => (
          <Topic
            key={title}
            id={title}
            title={t(title)}
            body={t(body)}
            open={search ? !collapsedMatches.includes(title) : expanded === title}
            onLayout={title === initial ? measureInitial : undefined}
            onPress={toggle}
          />
        ))}
        {!filtered.length && (
          <Text style={styles.body}>
            {t('No matching help topics. Try location, contacts, or trips.')}
          </Text>
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
  openCard: { borderColor: '#BCB5FF80' },
  card: {
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topicHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 12 },
  heading: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  chevron: { color: colors.accent, fontSize: 22 },
  answer: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 16 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 21 },
});
