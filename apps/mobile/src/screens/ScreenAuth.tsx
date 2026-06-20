import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Icon } from '../components/Icon';
import { FadeSlideIn } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface AuthProps {
  onLogin: (email: string, pw: string) => Promise<void>;
  onRegister: (firstName: string, lastName: string, email: string, pw: string) => Promise<void>;
  authError: string;
  authSuccess: string;
  onFaceIdLogin?: () => void;
}

export function ScreenAuth({ onLogin, onRegister, authError, authSuccess, onFaceIdLogin }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@finvault.com');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleFaceIdLogin = () => {
    if (onFaceIdLogin) {
      onFaceIdLogin();
    }
  };

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
            {mode === 'login' ? 'Sign in to your FinVault account.' : 'Your IBAN is ready in seconds.'}
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

          {/* Fields */}
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

            {mode === 'login' && (
              <View style={styles.forgotRow}>
                <Text style={styles.keepText}>Keep me signed in</Text>
                <TouchableOpacity>
                  <Text style={styles.forgotBtn}>Forgot?</Text>
                </TouchableOpacity>
              </View>
            )}

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

            {mode === 'login' && (
              <TouchableOpacity
                style={[styles.faceIdBtn, loading && { opacity: 0.5 }]}
                onPress={handleFaceIdLogin}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Face ID"
              >
                <Icon name="faceId" size={20} color={THEME.colors.accent} />
                <Text style={styles.faceIdText}>Sign in with Face ID</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Toggle mode */}
          <Text style={styles.toggleText}>
            {mode === 'login' ? 'New to FinVault? ' : 'Already have an account? '}
            <Text style={styles.toggleBtn} onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
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
}));
