import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { MobileSheet } from '../components/MobileExtras';
import { FadeSlideIn } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface Session { id: string; expiresAt: string; }

interface Props {
  token: string | null;
  apiUrl: string;
  fire: (t: string, b: string, type?: string) => void;
  onBack: () => void;
  onPasswordChanged: (accessToken: string, refreshToken: string) => void;
}

export function ScreenSecurityCenter({ token, apiUrl, fire, onBack, onPasswordChanged }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pwOpen, setPwOpen] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFASetup, setTwoFASetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/users/sessions`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSessions(await res.json());
    } catch { /* offline */ }
  }, [token, apiUrl]);

  const fetch2FAStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/users/2fa/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setTwoFAEnabled(data.enabled); }
    } catch {}
  }, [token, apiUrl]);

  useEffect(() => { fetchSessions(); fetch2FAStatus(); }, [fetchSessions, fetch2FAStatus]);

  const changePassword = async () => {
    if (!currentPw || !newPw) return;
    if (newPw.length < 8) { fire('Error', 'New password must be at least 8 characters.', 'error'); return; }
    if (newPw !== confirmPw) { fire('Error', 'Passwords do not match.', 'error'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/users/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (res.ok) {
        const data = await res.json();
        fire('Password changed', 'All other sessions have been revoked.', 'success');
        setPwOpen(false);
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        onPasswordChanged(data.accessToken, data.refreshToken);
        fetchSessions();
      } else {
        const err = await res.json();
        fire('Error', err.error || 'Failed to change password.', 'error');
      }
    } catch { fire('Error', 'Failed to change password.', 'error'); }
    setLoading(false);
  };

  const revokeSession = async (id: string) => {
    try {
      await fetch(`${apiUrl}/api/users/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fire('Session revoked', 'The session has been terminated.', 'success');
      fetchSessions();
    } catch { fire('Error', 'Failed to revoke session.', 'error'); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 88 }}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrowLeft" size={22} color={THEME.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Security Center</Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={60}>
        <TouchableOpacity style={styles.actionCard} onPress={() => setPwOpen(true)}>
          <View style={styles.actionIcon}><Icon name="lock" size={20} color={THEME.colors.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Change Password</Text>
            <Text style={styles.actionSub}>Update your account password</Text>
          </View>
          <Icon name="chevRight" size={18} color={THEME.colors.text3} />
        </TouchableOpacity>
      </FadeSlideIn>

      <FadeSlideIn delay={90}>
        <TouchableOpacity style={styles.actionCard} onPress={async () => {
          if (twoFAEnabled) {
            setTwoFAOpen(true);
          } else {
            try {
              const res = await fetch(`${apiUrl}/api/users/2fa/setup`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }
              });
              if (res.ok) { const data = await res.json(); setTwoFASetup(data); setTwoFAOpen(true); }
            } catch { fire('Error', 'Failed to setup 2FA', 'error'); }
          }
        }}>
          <View style={[styles.actionIcon, { backgroundColor: twoFAEnabled ? '#34d3991A' : THEME.colors.accentSoft }]}>
            <Icon name="shield" size={20} color={twoFAEnabled ? '#34d399' : THEME.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Two-Factor Authentication</Text>
            <Text style={styles.actionSub}>{twoFAEnabled ? 'Enabled — tap to disable' : 'Protect your account with TOTP'}</Text>
          </View>
          <View style={{ backgroundColor: twoFAEnabled ? '#34d3991A' : THEME.colors.surface2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: THEME.radius.pill }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: twoFAEnabled ? '#34d399' : THEME.colors.text3 }}>{twoFAEnabled ? 'ON' : 'OFF'}</Text>
          </View>
        </TouchableOpacity>
      </FadeSlideIn>

      <FadeSlideIn delay={120}>
        <Text style={styles.sectionTitle}>Active Sessions ({sessions.length})</Text>
        {sessions.map((s, i) => (
          <View key={s.id} style={styles.sessionCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionLabel}>Session</Text>
              <Text style={styles.sessionExpiry}>Expires {new Date(s.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            </View>
            <TouchableOpacity onPress={() => revokeSession(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: '#fb7185', fontSize: 12, fontWeight: '600' }}>Revoke</Text>
            </TouchableOpacity>
          </View>
        ))}
      </FadeSlideIn>

      <MobileSheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password">
        <View style={{ gap: 12, paddingVertical: 4 }}>
          <TextInput style={styles.input} placeholder="Current password" placeholderTextColor={THEME.colors.text3} value={currentPw} onChangeText={setCurrentPw} secureTextEntry />
          <TextInput style={styles.input} placeholder="New password (min 8 chars)" placeholderTextColor={THEME.colors.text3} value={newPw} onChangeText={setNewPw} secureTextEntry />
          <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={THEME.colors.text3} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry />
          <TouchableOpacity style={[styles.ctaBtn, { marginTop: 8 }]} onPress={changePassword} disabled={loading}>
            <Text style={styles.ctaBtnText}>{loading ? 'Changing...' : 'Change Password'}</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>

      <MobileSheet open={twoFAOpen} onClose={() => { setTwoFAOpen(false); setTwoFACode(''); }} title={twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}>
        <View style={{ gap: 16, paddingVertical: 4, alignItems: 'center' }}>
          {!twoFAEnabled && twoFASetup && (
            <>
              <Text style={{ color: THEME.colors.text2, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </Text>
              <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: THEME.radius.lg }}>
                <Text style={{ fontSize: 11, color: '#000', textAlign: 'center', fontFamily: 'monospace' }}>[QR Code — scan in authenticator app]</Text>
                <Text selectable style={{ fontSize: 12, color: '#333', textAlign: 'center', marginTop: 8, fontFamily: 'monospace', letterSpacing: 1 }}>{twoFASetup.secret}</Text>
              </View>
              <Text style={{ color: THEME.colors.text3, fontSize: 12, textAlign: 'center' }}>
                Or enter this key manually: <Text style={{ fontWeight: '700', color: THEME.colors.text }}>{twoFASetup.secret}</Text>
              </Text>
            </>
          )}
          {twoFAEnabled && (
            <Text style={{ color: THEME.colors.text2, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
              Enter your 6-digit authenticator code to disable 2FA
            </Text>
          )}
          <TextInput
            style={[styles.input, { fontSize: 24, fontWeight: '800', letterSpacing: 8, textAlign: 'center', paddingVertical: 16, width: '100%' }]}
            value={twoFACode}
            onChangeText={setTwoFACode}
            placeholder="000000"
            placeholderTextColor={THEME.colors.text3}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.ctaBtn, { width: '100%' }, (twoFALoading || twoFACode.length !== 6) && { opacity: 0.5 }]}
            disabled={twoFALoading || twoFACode.length !== 6}
            onPress={async () => {
              setTwoFALoading(true);
              try {
                const endpoint = twoFAEnabled ? '/api/users/2fa/disable' : '/api/users/2fa/verify';
                const res = await fetch(`${apiUrl}${endpoint}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ code: twoFACode }),
                });
                if (res.ok) {
                  fire(twoFAEnabled ? '2FA disabled' : '2FA enabled', twoFAEnabled ? 'Two-factor authentication has been turned off.' : 'Your account is now protected with 2FA.', 'success');
                  setTwoFAEnabled(!twoFAEnabled);
                  setTwoFAOpen(false);
                  setTwoFACode('');
                  setTwoFASetup(null);
                } else {
                  const err = await res.json();
                  fire('Error', err.error || 'Invalid code', 'error');
                }
              } catch { fire('Error', 'Verification failed', 'error'); }
              setTwoFALoading(false);
            }}
          >
            <Text style={styles.ctaBtnText}>{twoFALoading ? 'Verifying...' : twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '700', color: THEME.colors.text, flex: 1, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: THEME.colors.text3, marginTop: 24, marginBottom: 12, paddingHorizontal: 16, letterSpacing: 1, textTransform: 'uppercase' as const },
  actionCard: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 16, alignItems: 'center', gap: 14, marginBottom: 10, marginHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: THEME.colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { color: THEME.colors.text, fontWeight: '700', fontSize: 15, letterSpacing: -0.2 },
  actionSub: { color: THEME.colors.text2, fontSize: 12, marginTop: 2 },
  sessionCard: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 14, marginBottom: 8, marginHorizontal: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  sessionLabel: { color: THEME.colors.text, fontWeight: '600', fontSize: 14 },
  sessionExpiry: { color: THEME.colors.text3, fontSize: 12, marginTop: 2 },
  input: { backgroundColor: THEME.colors.surface, color: THEME.colors.text, borderRadius: THEME.radius.regular, borderWidth: 1, borderColor: THEME.colors.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  ctaBtn: { backgroundColor: THEME.colors.accent, paddingVertical: 14, borderRadius: THEME.radius.regular, alignItems: 'center', shadowColor: THEME.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  ctaBtnText: { color: THEME.colors.onAccent, fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
}));
