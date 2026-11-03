import { useTranslation } from '../../../shared/i18n/LanguageProvider';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ContactsPanelProps } from './ContactsPanel';
import { colors } from '../../../shared/theme/colors';
import { FormField } from '../../../shared/ui/FormField';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
export function ContactDialogs({
  state,
  commands,
}: Pick<ContactsPanelProps, 'state' | 'commands'>) {
  const { t } = useTranslation();

  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  return (
    <>
      <Modal
        visible={state.formOpen && !state.inboxOpen}
        transparent
        animationType={reducedMotion === false ? 'fade' : 'none'}
        onRequestClose={commands.cancel}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          // Android's modal window already resizes for the IME. A second height
          // adjustment here causes focus/layout feedback while the keyboard opens.
          enabled={Platform.OS === 'ios'}
          behavior="padding"
        >
          <View style={[styles.card, styles.formCard]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              bounces={false}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <Text accessibilityRole="header" style={styles.title}>
                {t('New contact')}
              </Text>
              <FormField
                label={t('Email')}
                value={state.email}
                onChangeText={commands.setEmail}
                placeholder="friend@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!state.busy}
                maxLength={254}
                returnKeyType="send"
                onSubmitEditing={commands.sendRequest}
              />
              <Text style={styles.muted}>
                {t('If accepted, you both share your name, email, birthday, and profile location.')}
              </Text>
              {!!state.error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {t(state.error)}
                </Text>
              )}
              <PrimaryButton
                busy={state.busy}
                label={t('Send request')}
                onPress={commands.sendRequest}
              />
              <Pressable
                accessibilityRole="button"
                disabled={state.busy}
                onPress={commands.cancel}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.muted}>{t('Cancel')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={state.inboxOpen}
        transparent
        animationType={reducedMotion === false ? 'fade' : 'none'}
        onRequestClose={commands.closeInbox}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('Contact notifications')}
            </Text>
            <ScrollView
              style={{ maxHeight: Math.max(100, Math.min(360, height - 250)) }}
              keyboardShouldPersistTaps="handled"
            >
              {!state.requests.length && !state.events.length && (
                <Text style={styles.muted}>{t('No pending requests.')}</Text>
              )}
              {state.events.map((event) => (
                <View key={event.id} style={styles.request}>
                  <Text accessibilityLiveRegion="polite" style={styles.name}>
                    {t(
                      event.kind === 'accepted'
                        ? '{name} accepted your contact request.'
                        : event.kind === 'declined'
                          ? '{name} declined your contact request.'
                          : '{name} removed you from their contacts.',
                      { name: event.name },
                    )}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!!state.actionId}
                    onPress={() => commands.dismissEvent(event.id)}
                    style={styles.action}
                  >
                    {state.actionId === event.id ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : (
                      <Text style={styles.accent}>{t('Dismiss')}</Text>
                    )}
                  </Pressable>
                </View>
              ))}
              {state.requests.map((request) => (
                <View key={request.id} style={styles.request}>
                  <Text style={styles.name}>{request.fromName}</Text>
                  <Text style={styles.muted}>{request.fromEmail}</Text>
                  <Text style={styles.muted}>
                    {t(
                      'Would like to add you as a contact. Agree shares your name, email, birthday, and profile location with each other.',
                    )}
                  </Text>
                  <View style={styles.buttons}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('Agree')}
                      disabled={!!state.actionId}
                      onPress={() => commands.respond(request, true)}
                      style={styles.action}
                    >
                      {state.actionId === request.id && state.requestAction === 'agree' ? (
                        <ActivityIndicator color={colors.accent} />
                      ) : (
                        <Text style={styles.accent}>{t('Agree')}</Text>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('Disagree')}
                      disabled={!!state.actionId}
                      onPress={() => commands.respond(request, false)}
                      style={styles.action}
                    >
                      {state.actionId === request.id && state.requestAction === 'disagree' ? (
                        <ActivityIndicator color={colors.accent} />
                      ) : (
                        <Text style={styles.muted}>{t('Disagree')}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
            {!!(state.error || state.notificationError) && (
              <Text accessibilityRole="alert" style={styles.error}>
                {t(state.error || state.notificationError)}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={commands.closeInbox}
              style={styles.action}
            >
              <Text style={styles.accent}>{t('Close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0009' },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.input,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formCard: { maxHeight: '100%', flexShrink: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 18 },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  accent: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  error: { color: '#ffb4be', lineHeight: 22, marginVertical: 12 },
  action: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  buttons: { flexDirection: 'row', gap: 20 },
  request: { paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border, gap: 6 },
});
