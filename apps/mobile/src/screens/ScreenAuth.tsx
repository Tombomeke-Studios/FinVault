import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/UI';
import { FadeSlideIn } from '../components/Motion';
import { findAccount, type SavedAccount } from '../lib/accounts';
import { THEME, themedSheet } from '../theme';

interface AuthProps {
  onLogin: (email: string, pw: string) => Promise<void>;
  onRegister: (firstName: string, lastName: string, email: string, pw: string) => Promise<void>;
  authError: string;
  authSuccess: string;
  pending2FA?: boolean;
  on2FAVerify?: (code: string) => Promise<void>;
  onCancel2FA?: () => void;
  /** Accounts signed in on this phone before (#121), most recent first. */
  accounts?: SavedAccount[];
  onBiometricLogin?: (email: string) => Promise<void>;
  onForgetAccount?: (email: string) => void;
  /** "Fingerprint", "Face ID", … */
  bioLabel?: string;
  /** Open straight on the password form with this email (switching to an account without biometrics). */
  prefillEmail?: string;
  /** Open on an empty password form ("Add another account"). */
  startWithForm?: boolean;
}

export function ScreenAuth({
  onLogin, onRegister, authError, authSuccess, pending2FA, on2FAVerify, onCancel2FA,
  accounts = [], onBiometricLogin, onForgetAccount, bioLabel = 'Biometrics', prefillEmail, startWithForm,
}: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [view, setView] = useState<'accounts' | 'form'>(accounts.length > 0 && !prefillEmail && !startWithForm ? 'accounts' : 'form');
  const [email, setEmail] = useState(prefillEmail ?? '');
  const [bioBusy, setBioBusy] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, pw);
      } else {
        await onRegister(firstName, lastName, email, pw);
      }
    } finally {
      setLoading(false);
    }
  };

  const bioSignIn = async (accountEmail: string) => {
    if (!onBiometricLogin) return;
    setBioBusy(accountEmail);
    try { await onBiometricLogin(accountEmail); } finally { setBioBusy(null); }
  };

  const pickAccount = (a: SavedAccount) => {
    if (a.biometric) { bioSignIn(a.email); return; }
    setEmail(a.email);
    setPw('');
    setMode('login');
    setView('form');
  };

  const confirmForget = (a: SavedAccount) => {
    Alert.alert(
      'Remove from this phone?',
      `${a.email} will no longer be listed here${a.biometric ? ` and ${bioLabel} sign-in for it is unlinked` : ''}. Your account itself is not affected.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => onForgetAccount?.(a.email) }],
    );
  };

  const typedAccount = findAccount(accounts, email);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboard}
    >
      <ScrollView contentContainerStyle={styles.scroll} bounces={false} keyboardShouldPersistTaps="handled">
        {/* Main card */}
        <FadeSlideIn style={styles.card} distance={20}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Icon name="shield" size={20} color={THEME.colors.onAccent} />
            </View>
            <Text style={styles.logoText}>FinVault</Text>
          </View>

          {/* Heading */}
          <Text style={styles.heading}>
            {mode === 'login' ? 'Welcome back' : 'Open your Vault'}
          </Text>
          <Text style={styles.subheading}>
            {mode === 'register' ? 'Your IBAN is ready in seconds.' : view === 'accounts' ? 'Choose an account to sign in.' : 'Sign in to your FinVault account.'}
          </Text>

          {/* Messages */}
          {!!authError && (
            <View style={[styles.msg, styles.errorMsg]}>
              <Icon name="x" size={14} color={THEME.colors.neg} />
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          )}
          {!!authSuccess && (
            <View style={[styles.msg, styles.successMsg]}>
              <Icon name="check" size={14} color={THEME.colors.pos} />
              <Text style={styles.successText}>{authSuccess}</Text>
            </View>
          )}

          {view === 'accounts' && !pending2FA ? (
            <View style={styles.form}>
              {accounts.map(a => (
                <View key={a.email} style={styles.accountRow}>
                  <TouchableOpacity
                    style={styles.accountMain}
                    onPress={() => pickAccount(a)}
                    disabled={!!bioBusy}
                    accessibilityRole="button"
                    accessibilityLabel={`${a.name}, ${a.email}. ${a.biometric ? `Sign in with ${bioLabel}` : 'Sign in with password'}`}
                  >
                    <Avatar initials={a.initials} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountName} numberOfLines={1}>{a.name}</Text>
                      <Text style={styles.accountEmail} numberOfLines={1}>{a.email}</Text>
                    </View>
                    {bioBusy === a.email ? (
                      <ActivityIndicator size="small" color={THEME.colors.accent} />
                    ) : a.biometric ? (
                      <View style={styles.bioChip}>
                        <Icon name={bioLabel.startsWith('Face') ? 'faceId' : 'fingerprint'} size={16} color={THEME.colors.accent} />
                      </View>
                    ) : (
                      <Icon name="chevRight" size={18} color={THEME.colors.text2} />
                    )}
                  </TouchableOpacity>
                  {onForgetAccount && (
                    <TouchableOpacity
                      onPress={() => confirmForget(a)}
                      style={styles.forgetBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${a.email} from this phone`}
                    >
                      <Icon name="x" size={16} color={THEME.colors.text2} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={styles.faceIdBtn}
                onPress={() => { setEmail(''); setPw(''); setView('form'); }}
                accessibilityRole="button"
              >
                <Icon name="plus" size={18} color={THEME.colors.accent} />
                <Text style={styles.faceIdText}>Use another account</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <View style={styles.form}>
            {mode === 'register' && (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>First name</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="John"
                    placeholderTextColor={THEME.colors.text3}
                    autoComplete="given-name"
                    textContentType="givenName"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.label}>Last name</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Doe"
                    placeholderTextColor={THEME.colors.text3}
                    autoComplete="family-name"
                    textContentType="familyName"
                  />
                </View>
              </View>
            )}

            <View>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@email.com"
                placeholderTextColor={THEME.colors.text3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
            </View>

            <View>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passWrapper}>
                <TextInput
                  style={[styles.input, { paddingRight: 48 }]}
                  value={pw}
                  onChangeText={setPw}
                  placeholder="••••••••"
                  placeholderTextColor={THEME.colors.text3}
                  secureTextEntry={!show}
                  autoCapitalize="none"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  textContentType={mode === 'login' ? 'password' : 'newPassword'}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShow(!show)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={show ? 'Hide password' : 'Show password'}
                >
                  <Icon name={show ? 'eyeOff' : 'eye'} size={18} color={THEME.colors.text3} />
                </TouchableOpacity>
              </View>
            </View>


            {pending2FA ? (
              <>
                <View style={styles.twoFABox}>
                  <Icon name="shield" size={24} color={THEME.colors.accent} />
                  <Text style={styles.twoFATitle}>Two-Factor Authentication</Text>
                  <Text style={styles.twoFADesc}>Enter the 6-digit code from your authenticator app</Text>
                  <TextInput
                    style={[styles.input, styles.twoFAInput]}
                    value={twoFACode}
                    onChangeText={setTwoFACode}
                    placeholder="000000"
                    placeholderTextColor={THEME.colors.text3}
                    keyboardType="number-pad"
                    maxLength={6}
                    textAlign="center"
                    autoFocus
                  />
                </View>
                <TouchableOpacity
                  style={[styles.submitBtn, (loading || twoFACode.length !== 6) && { opacity: 0.7 }]}
                  onPress={async () => { setLoading(true); await on2FAVerify?.(twoFACode); setLoading(false); }}
                  disabled={loading || twoFACode.length !== 6}
                  accessibilityRole="button"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={THEME.colors.onAccent} />
                  ) : (
                    <Text style={styles.submitText}>Verify</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.faceIdBtn}
                  onPress={() => { onCancel2FA?.(); setTwoFACode(''); }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel 2FA and go back to login"
                >
                  <Icon name="arrowLeft" size={18} color={THEME.colors.text2} />
                  <Text style={styles.faceIdText}>Back to login</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                  onPress={submit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loading, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={THEME.colors.onAccent} />
                  ) : (
                    <>
                      <Text style={styles.submitText}>
                        {mode === 'login' ? 'Sign in' : 'Create account'}
                      </Text>
                      <Icon name="chevRight" size={16} color={THEME.colors.onAccent} />
                    </>
                  )}
                </TouchableOpacity>

                {mode === 'login' && typedAccount?.biometric && (
                  <TouchableOpacity
                    style={[styles.faceIdBtn, (loading || !!bioBusy) && { opacity: 0.5 }]}
                    onPress={() => bioSignIn(typedAccount.email)}
                    disabled={loading || !!bioBusy}
                    accessibilityRole="button"
                  >
                    <Icon name={bioLabel.startsWith('Face') ? 'faceId' : 'fingerprint'} size={20} color={THEME.colors.accent} />
                    <Text style={styles.faceIdText}>Use {bioLabel} instead</Text>
                  </TouchableOpacity>
                )}

                {mode === 'login' && accounts.length > 0 && (
                  <TouchableOpacity
                    style={styles.faceIdBtn}
                    onPress={() => setView('accounts')}
                    accessibilityRole="button"
                  >
                    <Icon name="arrowLeft" size={18} color={THEME.colors.text2} />
                    <Text style={[styles.faceIdText, { color: THEME.colors.text2 }]}>Saved accounts</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
          )}

          {/* Toggle mode */}
          <Text style={styles.toggleText}>
            {mode === 'login' ? 'New to FinVault? ' : 'Already have an account? '}
            <Text style={styles.toggleBtn} accessibilityRole="link" onPress={() => { setView('form'); setMode(mode === 'login' ? 'register' : 'login'); }}>
              {mode === 'login' ? 'Open an account' : 'Sign in'}
            </Text>
          </Text>
        </FadeSlideIn>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  keyboard: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.colors.text,
    fontFamily: THEME.fonts.display,
  },
  subheading: {
    fontSize: 14,
    color: THEME.colors.text2,
    marginTop: 6,
    marginBottom: 24,
  },
  msg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: THEME.radius.regular,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorMsg: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderColor: THEME.colors.neg,
  },
  errorText: {
    color: THEME.colors.neg,
    fontSize: 13,
    fontWeight: '500',
  },
  successMsg: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderColor: THEME.colors.pos,
  },
  successText: {
    color: THEME.colors.pos,
    fontSize: 13,
    fontWeight: '500',
  },
  form: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.text2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: THEME.colors.text,
    fontSize: 15,
  },
  passWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    backgroundColor: THEME.colors.surface2,
  },
  accountMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    minHeight: 64,
  },
  accountName: { fontSize: 15, fontWeight: '700', color: THEME.colors.text },
  accountEmail: { fontSize: 13, color: THEME.colors.text2, marginTop: 1 },
  bioChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgetBtn: {
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: THEME.colors.line,
  },
  forgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  keepText: {
    fontSize: 13,
    color: THEME.colors.text3,
  },
  forgotBtn: {
    fontSize: 13,
    color: THEME.colors.accent,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: THEME.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  submitText: {
    color: THEME.colors.onAccent,
    fontSize: 15,
    fontWeight: 'bold',
  },
  toggleText: {
    fontSize: 13.5,
    color: THEME.colors.text2,
    textAlign: 'center',
    marginTop: 24,
  },
  toggleBtn: {
    color: THEME.colors.accent,
    fontWeight: 'bold',
  },
  faceIdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: THEME.colors.surface2,
  },
  faceIdText: {
    color: THEME.colors.text2,
    fontSize: 14.5,
    fontWeight: '600',
  },
  twoFABox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    padding: 24,
    marginBottom: 8,
  },
  twoFATitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
    letterSpacing: -0.3,
  },
  twoFADesc: {
    fontSize: 13,
    color: THEME.colors.text2,
    textAlign: 'center',
    lineHeight: 18,
  },
  twoFAInput: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 8,
    paddingVertical: 16,
    width: '100%',
  },
}));
