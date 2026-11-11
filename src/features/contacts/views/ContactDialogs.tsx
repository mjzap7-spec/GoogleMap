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
import type { ContactOverlayState } from '../viewmodels/contactSelectors';
import { colors } from '../../../shared/theme/colors';
import { FormField } from '../../../shared/ui/FormField';
import { useReducedMotion } from '../../../shared/motion/useReducedMotion';
import { PrimaryButton } from '../../../shared/ui/PrimaryButton';
import { Avatar } from '../../../shared/ui/Avatar';
import { InboxIcon } from '../../../shared/ui/ChatIcon';
export function ContactDialogs({
  state,
  commands,
}: Pick<ContactsPanelProps, 'commands'> & { state: Readonly<ContactOverlayState> }) {
  const { t } = useTranslation();

  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const requests = state.requests.filter((i) => state.inboxManual || !i.acknowledged);
  const events = state.events.filter((i) => state.inboxManual || !i.acknowledged);
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
              <DialogHeader
                title={t('New contact')}
                onClose={commands.cancel}
                disabled={state.busy}
              />
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
                disabled={!state.email.trim()}
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
            <DialogHeader title={t('Inbox')} onClose={commands.closeInbox} />
            <ScrollView
              style={{ maxHeight: Math.max(100, Math.min(520, height - 220)) }}
              keyboardShouldPersistTaps="handled"
            >
              {!requests.length && !events.length && (
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <InboxIcon />
                  </View>
                  <Text style={styles.muted}>{t('No pending requests.')}</Text>
                </View>
              )}
              {events.map((event) => (
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
              {requests.map((request) => (
                <View key={request.id} style={styles.request}>
                  <View style={styles.person}>
                    <Avatar name={request.fromName} size={40} />
                    <View style={styles.identity}>
                      <Text style={styles.name}>{request.fromName}</Text>
                      <Text selectable style={styles.email}>
                        {request.fromEmail}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.explanation}>
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
                      style={({ pressed }) => [
                        styles.response,
                        styles.agree,
                        pressed && styles.pressed,
                      ]}
                    >
                      {state.actionId === request.id && state.requestAction === 'agree' ? (
                        <ActivityIndicator color={colors.buttonText} />
                      ) : (
                        <Text style={styles.agreeText}>{t('Agree')}</Text>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('Disagree')}
                      disabled={!!state.actionId}
                      onPress={() => commands.respond(request, false)}
                      style={({ pressed }) => [
                        styles.response,
                        styles.decline,
                        pressed && styles.pressed,
                      ]}
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
          </View>
        </View>
      </Modal>
    </>
  );
}
function DialogHeader({
  title,
  onClose,
  disabled = false,
}: {
  title: string;
  onClose: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Close')}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onClose}
        style={({ pressed }) => [
          styles.close,
          pressed && styles.pressed,
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text accessible={false} style={styles.closeText}>
          ×
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0009' },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.input,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formCard: { maxHeight: '100%', flexShrink: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '700' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF05',
  },
  closeText: { color: colors.muted, fontSize: 26 },
  name: { color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  accent: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  error: { color: '#ffb4be', lineHeight: 22, marginVertical: 12 },
  action: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  buttons: { flexDirection: 'row', gap: 8 },
  response: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agree: { backgroundColor: colors.accent },
  agreeText: { color: colors.buttonText, fontSize: 14, fontWeight: '600' },
  decline: { borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.7 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  email: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  explanation: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  request: {
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2B2E3A',
    backgroundColor: '#14161E',
    borderRadius: 18,
    gap: 12,
  },
  empty: { alignItems: 'center', gap: 14, paddingVertical: 28 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BCB5FF10',
  },
});
