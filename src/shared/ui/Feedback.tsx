import { useTranslation } from '../i18n/LanguageProvider';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion } from '../motion/tokens';
import { useReducedMotion } from '../motion/useReducedMotion';
import { colors } from '../theme/colors';
import type { DismissalReceipts } from '../feedback/DismissalReceipts';
interface ErrorToast {
  id: string;
  key: string;
  message: string;
  isError: true;
}
type Toast = (ErrorToast | { message: string; isError: false }) & { scope: string };
interface FeedbackCommands {
  show: (toast: ErrorToast) => void;
  showNotice: (message: string) => void;
  hide: (id: string) => void;
  resolved: (key: string) => void;
}
const Context = createContext<FeedbackCommands | null>(null);
/** Feedback lives above the screens and never reserves space inside a form. */
export function FeedbackProvider({
  children,
  scope,
  receipts,
}: PropsWithChildren<{ scope: string; receipts: DismissalReceipts }>) {
  const [latest, setToast] = useState<Toast | null>(null);
  const toast = latest?.scope === scope ? latest : null;
  const [content, setContent] = useState<Toast | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const pending = useRef<ErrorToast | null>(null);
  const show = useCallback(
    (value: ErrorToast) => {
      pending.current = value;
      void receipts.has(scope, value.key).then((ignored) => {
        if (!ignored && pending.current === value) setToast({ ...value, scope });
      });
    },
    [scope, receipts],
  );
  const showNotice = useCallback(
    (message: string) => {
      pending.current = null;
      setToast({ message, scope, isError: false });
    },
    [scope],
  );
  const resolved = useCallback(
    (key: string) => {
      void receipts.set(scope, key, false);
    },
    [scope, receipts],
  );
  const hide = useCallback((id: string) => {
    if (pending.current?.id === id) pending.current = null;
    setToast((current) => (current?.isError && current.id === id ? null : current));
  }, []);
  const commands = useMemo(
    () => ({ show, showNotice, hide, resolved }),
    [show, showNotice, hide, resolved],
  );
  if (toast && toast !== content) setContent(toast);
  else if (content && content.scope !== scope) setContent(null);
  if (latest && latest.scope !== scope) setToast(null);
  useEffect(() => {
    if (!toast || toast.isError) return;
    const timer = setTimeout(
      () => setToast((current) => (current === toast ? null : current)),
      2000,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    opacity.stopAnimation();
    if (reducedMotion !== false) {
      opacity.setValue(toast ? 1 : 0);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: toast ? 1 : 0,
      duration: toast ? motion.feedbackEnterDuration : motion.feedbackExitDuration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [toast, opacity, reducedMotion]);
  return (
    <Context.Provider value={commands}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
        <Animated.View
          pointerEvents={toast ? 'auto' : 'none'}
          accessibilityElementsHidden={!toast}
          importantForAccessibility={toast ? 'auto' : 'no-hide-descendants'}
          aria-hidden={!toast}
          style={[
            styles.toast,
            content?.isError ? styles.error : styles.notice,
            {
              opacity,
              transform: [
                { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
              ],
            },
          ]}
        >
          <Text
            accessibilityRole={content?.isError ? 'alert' : undefined}
            accessibilityLiveRegion={toast ? 'polite' : 'none'}
            style={styles.message}
          >
            {t(content?.message)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Dismiss')}
            onPress={() => {
              if (toast?.isError) {
                void receipts.set(scope, toast.key, true);
                hide(toast.id);
              } else if (toast) {
                setToast((current) => (current === toast ? null : current));
              }
            }}
            style={styles.dismiss}
          >
            <Text style={styles.close}>×</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Context.Provider>
  );
}
/** Subscribe at the lifetime of the model, independently of the screen displaying its form. */
export function useActionNotices(model: {
  observeNotices: (show: (message: string) => void) => () => void;
}) {
  const commands = useContext(Context);
  useEffect(
    () => (commands ? model.observeNotices(commands.showNotice) : undefined),
    [model, commands],
  );
}
export function Feedback({
  error,
  source,
  visible = true,
}: {
  error: string;
  source: string;
  visible?: boolean;
}) {
  const commands = useContext(Context);
  const id = useId();
  const key = error ? JSON.stringify([source, true, error]) : '';
  const previous = useRef<{ key: string; commands: FeedbackCommands | null } | null>(null);
  useEffect(() => {
    if (
      previous.current?.key &&
      previous.current.commands === commands &&
      previous.current.key !== key
    )
      commands?.resolved(previous.current.key);
    previous.current = { key, commands };
    if (!commands || !error || !visible) return;
    commands.show({ id, key, message: error, isError: true });
    return () => commands.hide(id);
  }, [commands, id, key, error, visible]);
  return null;
}
const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, zIndex: 1000, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  error: { backgroundColor: '#33202A', borderColor: '#663747' },
  notice: { backgroundColor: '#1C3026', borderColor: '#335844' },
  message: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 20, paddingVertical: 12 },
  dismiss: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  close: { color: colors.text, fontSize: 24 },
});
