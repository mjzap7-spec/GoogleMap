import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { User, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './src/firebase';

type Mode = 'signin' | 'signup' | 'reset';
const messages: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'This email already has an account. Try signing in.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Please choose a stronger password.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/network-request-failed': 'Check your internet connection and try again.',
  'auth/operation-not-allowed': 'Enable Email/Password authentication in Firebase.',
};
export default function App() {
  const [mode, setMode] = useState<Mode>('signin');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    try {
      return onAuthStateChanged(getFirebaseAuth(), next => { setUser(next); setLoading(false); }, () => { setError('Could not restore your session. Restart the app to retry.'); setLoading(false); });
    } catch { setError('Check your Firebase configuration and restart the app.'); setLoading(false); }
  }, []);
  function navigate(next: Mode) {
    setMode(next); setError(''); setNotice(''); setPassword(''); setConfirm(''); setShow(false);
  }
  async function submit() {
    if (busy) return;
    setError(''); setNotice('');
    if (!isFirebaseConfigured) { setError('Follow README.md and add your Firebase project configuration to .env first.'); return; }
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { setError('Please enter a valid email address.'); return; }
    if (mode !== 'reset' && !password) { setError('Please enter your password.'); return; }
    if (mode === 'signup' && password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (mode === 'signup' && password !== confirm) { setError('Your passwords do not match.'); return; }
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      if (mode === 'reset') { await sendPasswordResetEmail(auth, address); setNotice('If an account exists, you will receive a password reset link.'); }
      else {
        if (mode === 'signup') await createUserWithEmailAndPassword(auth, address, password);
        else await signInWithEmailAndPassword(auth, address, password);
        setPassword(''); setConfirm('');
      }
    } catch (cause) {
      const code = (cause as { code?: string }).code ?? '';
      if (mode === 'reset' && code === 'auth/user-not-found') setNotice('If an account exists, you will receive a password reset link.');
      else setError(messages[code] ?? 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await signOut(getFirebaseAuth()); setEmail(''); navigate('signin'); }
    catch { setError('Could not sign out. Please try again.'); }
    finally { setBusy(false); }
  }
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#246B54" /><Text>Restoring your session...</Text></View>;
  return <View style={s.screen}><StatusBar style="dark" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <View style={s.brand}><View style={s.logo}><Text style={s.logoText}>n</Text></View><Text style={s.brandText}>nest</Text></View>
        <View style={s.card}>
          <Text style={s.eyebrow}>{user ? 'YOUR SPACE' : 'A LITTLE SPACE FOR YOU'}</Text>
          <Text accessibilityRole="header" style={s.title}>{user ? 'You’re home.' : mode === 'signup' ? 'Make yourself\nat home.' : mode === 'reset' ? 'Let’s get you\nback in.' : 'Welcome\nback.'}</Text>
          <Text style={s.subtitle}>{user ? `Signed in as ${user.email}` : mode === 'signup' ? 'Create an account to get started.' : mode === 'reset' ? 'We’ll email you a link to reset your password.' : 'Good to see you. Sign in to your account.'}</Text>
          {!isFirebaseConfigured && <Text style={s.setup}>Ready for Firebase setup. Add your project configuration to enable authentication.</Text>}
          {!user && <View style={s.form}>
            <Text style={s.label}>Email address</Text>
            <TextInput accessibilityLabel="Email address" style={s.input} placeholder="you@example.com" placeholderTextColor="#84938B" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} />
            {mode !== 'reset' && <><Text style={s.label}>Password</Text><View style={s.passwordRow}>
              <TextInput accessibilityLabel="Password" style={[s.input, { paddingRight: 70 }]} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} placeholderTextColor="#84938B" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} editable={!busy} />
              <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow(!show)} style={s.show}><Text style={s.link}>{show ? 'Hide' : 'Show'}</Text></Pressable>
            </View></>}
            {mode === 'signup' && <><Text style={s.label}>Confirm password</Text><TextInput accessibilityLabel="Confirm password" style={s.input} placeholder="Enter your password again" placeholderTextColor="#84938B" value={confirm} onChangeText={setConfirm} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!busy} /></>}
            {mode === 'signin' && <Pressable accessibilityRole="button" disabled={busy} style={s.forgot} onPress={() => navigate('reset')}><Text style={s.link}>Forgot password?</Text></Pressable>}
          </View>}
          {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
          {!!notice && <Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={user ? logout : submit} style={({ pressed }) => [s.button, (busy || pressed) && { opacity: 0.65 }]}>{busy ? <ActivityIndicator color="white" /> : <Text style={s.buttonText}>{user ? 'Sign out' : mode === 'signup' ? 'Create account  →' : mode === 'reset' ? 'Send reset link  →' : 'Sign in  →'}</Text>}</Pressable>
          {!user && <View style={s.switchRow}><Text style={s.muted}>{mode === 'signin' ? 'New here?' : mode === 'signup' ? 'Already have an account?' : 'Remember your password?'}</Text><Pressable accessibilityRole="button" disabled={busy} style={s.switchButton} onPress={() => navigate(mode === 'signin' ? 'signup' : 'signin')}><Text style={s.link}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</Text></Pressable></View>}
        </View><Text style={s.footer}>YOUR NEXT CHAPTER STARTS HERE.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F5EE' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: 64, paddingBottom: 36 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 }, logo: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#246B54', justifyContent: 'center', alignItems: 'center' }, logoText: { fontSize: 29, fontWeight: '700', color: 'white', marginTop: -4 }, brandText: { fontSize: 28, fontWeight: '700', color: '#203F33', letterSpacing: -1 },
  card: { width: '100%', maxWidth: 460, backgroundColor: 'white', borderRadius: 28, padding: 28, borderWidth: 1, borderColor: '#E3E9E0' }, eyebrow: { color: '#597361', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 19 }, title: { fontSize: 42, lineHeight: 47, letterSpacing: -1.8, fontWeight: '600', color: '#203F33', marginBottom: 14 }, subtitle: { fontSize: 15, lineHeight: 23, color: '#6C7A72' },
  form: { marginTop: 28 }, label: { fontSize: 13, fontWeight: '600', color: '#304D40', marginBottom: 9 }, input: { minHeight: 52, borderWidth: 1, borderColor: '#DDE4DF', backgroundColor: '#FBFCFA', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 15, fontSize: 15, color: '#203F33', marginBottom: 19 }, passwordRow: { position: 'relative' }, show: { position: 'absolute', right: 4, top: 4, padding: 13, minHeight: 44 }, link: { color: '#246B54', fontSize: 13, fontWeight: '600' }, forgot: { alignSelf: 'flex-end', minHeight: 44, paddingTop: 8, marginTop: -8 },
  button: { minHeight: 54, justifyContent: 'center', alignItems: 'center', borderRadius: 13, backgroundColor: '#246B54', marginTop: 12 }, buttonText: { fontSize: 15, fontWeight: '600', color: 'white' }, switchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 20 }, switchButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }, muted: { fontSize: 13, color: '#78847D' }, footer: { fontSize: 9, letterSpacing: 2, color: '#859184', marginTop: 30 }, setup: { fontSize: 12, lineHeight: 18, color: '#536441', backgroundColor: '#F2F5EA', padding: 12, borderRadius: 10, marginTop: 20 }, error: { color: '#A43131', backgroundColor: '#FFF1F0', padding: 12, borderRadius: 10, marginTop: 12, lineHeight: 20 }, notice: { color: '#246B54', backgroundColor: '#EDF7F0', padding: 12, borderRadius: 10, marginTop: 12, lineHeight: 20 },
});
