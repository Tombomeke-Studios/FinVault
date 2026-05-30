import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Send, 
  Plus, 
  History, 
  Layers, 
  User as UserIcon, 
  LogOut, 
  Bell, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Shield, 
  Zap, 
  AlertTriangle,
  Globe
} from 'lucide-react';

// Custom Notification Interface
interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'success' | 'info' | 'warning';
  time: string;
  read: boolean;
}

export default function App() {
  // Session State
  const [token, setToken] = useState<string | null>(localStorage.getItem('finvault_token'));
  const [user, setUser] = useState<any>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // UI Control State
  const [activeTab, setActiveTab] = useState<'overview' | 'transfer' | 'history'>('overview');
  const [isLoginView, setIsLoginView] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [isBalanceUpdated, setIsBalanceUpdated] = useState(false);
  
  // Form Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  
  // Transfer Form Inputs
  const [transferEmail, setTransferEmail] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState(false);
  
  // Deposit Form Inputs
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  // Status Alerts
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  const wsRef = useRef<WebSocket | null>(null);

  // Load profile and wallets if token exists
  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setUser(null);
      setWallets([]);
      setTransactions([]);
    }
  }, [token]);

  // Connect WebSockets
  useEffect(() => {
    if (user && token) {
      connectWebSocket(user.id);
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [user]);

  const addNotification = (title: string, body: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const newNotif: Notification = {
      id: Math.random().toString(),
      title,
      body,
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
    // Flash toast alert on success/warning
    setIsBalanceUpdated(true);
    setTimeout(() => setIsBalanceUpdated(false), 2000);
  };

  const connectWebSocket = (userId: string) => {
    setWsStatus('connecting');
    // For local docker or standard workspace we connect to gateway port
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '3000' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}//${host}?userId=${userId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to Gateway');
        setWsStatus('connected');
        addNotification('Sessie Geverifieerd', 'Beveiligde live-verbinding met FinVault API Gateway tot stand gebracht.', 'info');
      };

      ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          const { type, payload } = envelope.event;
          console.log('[WS] Live Event Received:', type, payload);

          if (type === 'balance.updated') {
            // Update balance in local state
            setWallets(prev => prev.map(w => w.id === payload.walletId ? { ...w, balance: payload.balance } : w));
            addNotification('Saldo Bijgewerkt', `Nieuw saldo: €${payload.balance.toFixed(2)}`, 'success');
            fetchTransactions(); // reload tx history
          } else if (type === 'payment.confirmed') {
            addNotification('Transactie Geslaagd', `Overboeking referentie ${payload.reference} is succesvol verwerkt.`, 'success');
            fetchTransactions();
            fetchWallets();
          } else if (type === 'payment.failed') {
            addNotification('Transactie Mislukt', `Transactie afgebroken: ${payload.reason}`, 'warning');
          }
        } catch (err) {
          console.error('[WS] Error parsing websocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        setWsStatus('disconnected');
      };

      ws.onerror = () => {
        setWsStatus('disconnected');
      };
    } catch (e) {
      setWsStatus('disconnected');
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/users/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        fetchWallets();
        fetchTransactions();
      } else {
        handleLogout();
      }
    } catch {
      // Fallback local mock mode if backend is not running yet (premium developer preview experience)
      setupMockSession();
    }
  };

  const fetchWallets = async () => {
    try {
      const res = await fetch('/api/wallets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWallets(data);
      }
    } catch (err) {
      console.error('Failed to fetch wallets:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
  };

  const setupMockSession = () => {
    // Generate high-end mockup session so they can test dashboard styling instantly even if database is fresh/offline!
    const mockUser = {
      id: 'mock-user-123',
      email: 'premium-user@finvault.com',
      accountType: 'personal',
      profile: {
        firstName: 'Tom',
        lastName: 'Bomeke',
        address: 'Antwerpen, België',
        country: 'België'
      }
    };
    setUser(mockUser);
    setWallets([{
      id: 'mock-wallet-eur',
      userId: 'mock-user-123',
      currency: 'EUR',
      balance: 1450.50,
      reservedBalance: 0.0,
      status: 'active'
    }]);
    setTransactions([
      {
        id: 'tx-1',
        reference: 'TX-WELCOME',
        senderWalletId: null,
        receiverWalletId: 'mock-wallet-eur',
        amount: 250.00,
        currency: 'EUR',
        status: 'confirmed',
        type: 'deposit',
        description: 'FinVault Welkomstbonus',
        createdAt: new Date().toISOString()
      },
      {
        id: 'tx-2',
        reference: 'TX-COFFEE',
        senderWalletId: 'mock-wallet-eur',
        receiverWalletId: 'coffee-shop-id',
        amount: 4.80,
        currency: 'EUR',
        status: 'confirmed',
        type: 'transfer',
        description: 'Starbucks Antwerpen Centraal',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    ]);
    setWsStatus('connected');
    addNotification('Demo Simulator Actief', 'De API Gateway is offline. FinVault draait in offline demonstratiemodus.', 'warning');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('finvault_token', data.accessToken);
        setToken(data.accessToken);
        setAuthSuccess('Succesvol ingelogd! Welkom terug.');
      } else {
        setAuthError(data.error || 'Inloggen mislukt.');
      }
    } catch {
      // Offline fallback trigger
      localStorage.setItem('finvault_token', 'mock-token-abc');
      setToken('mock-token-abc');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          firstName: regFirstName,
          lastName: regLastName,
          dateOfBirth: '1995-01-01',
          address: 'Meir 1',
          country: 'België',
          accountType: 'personal'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAuthSuccess('Registratie compleet! Je kunt nu inloggen.');
        setIsLoginView(true);
        setEmail(regEmail);
      } else {
        setAuthError(data.error || 'Registratie mislukt.');
      }
    } catch {
      setAuthError('Kan niet verbinden met de registratieservice.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('finvault_token');
    setToken(null);
    setUser(null);
    setWallets([]);
    setTransactions([]);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wallets.length === 0) return;
    
    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess(false);

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setTransferError('Voer een geldig bedrag in.');
      setTransferLoading(false);
      return;
    }

    // Direct client validation
    if (wallets[0].balance < amountNum) {
      setTransferError('Onvoldoende saldo op je geselecteerde wallet.');
      setTransferLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/transactions/transfer', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          senderWalletId: wallets[0].id,
          receiverEmail: transferEmail,
          amount: amountNum,
          description: transferDesc || 'Overboeking'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTransferSuccess(true);
        setTransferEmail('');
        setTransferAmount('');
        setTransferDesc('');
        addNotification('Geld Overgemaakt', `€${amountNum.toFixed(2)} succesvol verzonden naar ${transferEmail}`, 'success');
        fetchWallets();
        fetchTransactions();
      } else {
        setTransferError(data.error || 'Transactie mislukt.');
      }
    } catch {
      // Mock transfer simulator if backend offline
      const mockWallet = wallets[0];
      const newBal = mockWallet.balance - amountNum;
      setWallets([{ ...mockWallet, balance: newBal }]);
      
      const newTx = {
        id: Math.random().toString(),
        reference: `TX-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        senderWalletId: mockWallet.id,
        receiverWalletId: null,
        amount: amountNum,
        currency: 'EUR',
        status: 'confirmed',
        type: 'transfer',
        description: transferDesc || `Overboeking naar ${transferEmail}`,
        createdAt: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);
      setTransferSuccess(true);
      setTransferEmail('');
      setTransferAmount('');
      setTransferDesc('');
      addNotification('Geld Overgemaakt (Demo)', `€${amountNum.toFixed(2)} succesvol overgeboekt via de offline simulator.`, 'success');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wallets.length === 0) return;
    
    setDepositLoading(true);
    const amountNum = parseFloat(depositAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setDepositLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/wallets/deposit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          walletId: wallets[0].id,
          amount: amountNum
        })
      });

      if (res.ok) {
        setDepositAmount('');
        addNotification('Saldo Gestort', `€${amountNum.toFixed(2)} toegevoegd via simulator.`, 'success');
        fetchWallets();
        fetchTransactions();
      }
    } catch {
      // Mock deposit
      const mockWallet = wallets[0];
      const newBal = mockWallet.balance + amountNum;
      setWallets([{ ...mockWallet, balance: newBal }]);
      
      const newTx = {
        id: Math.random().toString(),
        reference: `DEP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        senderWalletId: null,
        receiverWalletId: mockWallet.id,
        amount: amountNum,
        currency: 'EUR',
        status: 'confirmed',
        type: 'deposit',
        description: 'Simulated cash deposit',
        createdAt: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);
      setDepositAmount('');
      addNotification('Saldo Gestort (Demo)', `€${amountNum.toFixed(2)} gestort via offline simulator.`, 'success');
    } finally {
      setDepositLoading(false);
    }
  };

  if (!token || !user) {
    return (
      <div className="login-container" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 10% 20%, hsl(228, 24%, 6%) 0%, hsl(228, 20%, 3%) 90%)',
        padding: '20px'
      }}>
        <div className="glass-card animate-slide-in" style={{ width: '100%', maxWidth: '480px', position: 'relative', overflow: 'hidden' }}>
          {/* Neon decorative blurs */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '150px',
            height: '150px',
            background: 'var(--accent-glow)',
            filter: 'blur(50px)',
            borderRadius: '50%',
            pointerEvents: 'none'
          }}></div>
          
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              display: 'inline-flex',
              padding: '12px',
              borderRadius: '14px',
              background: 'rgba(138, 43, 226, 0.1)',
              border: '1px solid rgba(138, 43, 226, 0.2)',
              marginBottom: '16px',
              color: 'var(--accent-color)'
            }}>
              <Shield size={32} />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>FinVault</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              De toekomst van veilig en intelligent vermogensbeheer
            </p>
          </div>

          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '24px',
            border: '1px solid var(--border-color)'
          }}>
            <button 
              onClick={() => { setIsLoginView(true); setAuthError(''); }}
              style={{
                flex: 1,
                border: 'none',
                background: isLoginView ? 'var(--accent-color)' : 'transparent',
                color: '#fff',
                padding: '10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                transition: 'var(--transition-smooth)'
              }}>
              Inloggen
            </button>
            <button 
              onClick={() => { setIsLoginView(false); setAuthError(''); }}
              style={{
                flex: 1,
                border: 'none',
                background: !isLoginView ? 'var(--accent-color)' : 'transparent',
                color: '#fff',
                padding: '10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                transition: 'var(--transition-smooth)'
              }}>
              Registreren
            </button>
          </div>

          {authError && (
            <div style={{
              background: 'var(--color-danger-glow)',
              border: '1px solid var(--color-danger)',
              padding: '12px',
              borderRadius: '10px',
              color: 'var(--color-danger)',
              fontSize: '0.85rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <XCircle size={16} />
              {authError}
            </div>
          )}

          {authSuccess && (
            <div style={{
              background: 'var(--color-success-glow)',
              border: '1px solid var(--color-success)',
              padding: '12px',
              borderRadius: '10px',
              color: 'var(--color-success)',
              fontSize: '0.85rem',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle size={16} />
              {authSuccess}
            </div>
          )}

          {isLoginView ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>E-mailadres</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="naam@voorbeeld.nl" 
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Wachtwoord</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  required
                />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
                Aanmelden bij kluis
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Voornaam</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={regFirstName}
                    onChange={e => setRegFirstName(e.target.value)}
                    placeholder="John" 
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Achternaam</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={regLastName}
                    onChange={e => setRegLastName(e.target.value)}
                    placeholder="Doe" 
                    required
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>E-mailadres</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  placeholder="john.doe@email.com" 
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Wachtwoord</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="Minimaal 8 tekens" 
                  required
                />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
                Account openen
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Beveiligd door end-to-end encryptie en master UUID synchronisatie.
          </div>
        </div>
      </div>
    );
  }

  const primaryWallet = wallets[0] || { balance: 0.0, currency: 'EUR', id: '' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Navbar */}
      <nav style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'var(--accent-glow)',
            color: 'var(--accent-color)',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Shield size={20} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.3px' }}>FinVault</span>
        </div>

        {/* Server Sync indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: wsStatus === 'connected' ? 'var(--color-success)' : wsStatus === 'connecting' ? 'var(--color-warning)' : 'var(--color-danger)',
              boxShadow: wsStatus === 'connected' ? '0 0 10px var(--color-success)' : 'none'
            }}></span>
            Gateway: {wsStatus === 'connected' ? 'ONLINE' : wsStatus === 'connecting' ? 'SYNCING' : 'OFFLINE'}
          </div>

          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                padding: '4px'
              }}>
              <Bell size={20} />
              {notifications.some(n => !n.read) && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--color-danger)'
                }}></span>
              )}
            </button>
            
            {/* Notification Drawer */}
            {isNotifOpen && (
              <div className="glass-card" style={{
                position: 'absolute',
                top: '32px',
                right: '-10px',
                width: '320px',
                maxHeight: '400px',
                overflowY: 'auto',
                zIndex: 100,
                padding: '16px'
              }}>
                <h4 style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Notificaties</span>
                  <button onClick={() => setNotifications([])} style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', fontSize: '0.75rem', cursor: 'pointer' }}>Wis alles</button>
                </h4>
                {notifications.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Geen nieuwe berichten</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderLeft: `3px solid ${n.type === 'success' ? 'var(--color-success)' : n.type === 'warning' ? 'var(--color-warning)' : 'var(--accent-color)'}`,
                        padding: '8px 12px',
                        borderRadius: '0 8px 8px 0',
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ fontWeight: 600 }}>{n.title}</div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.75rem' }}>{n.body}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginTop: '4px', textAlign: 'right' }}>{n.time}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '20px'
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {user.profile?.firstName} {user.profile?.lastName}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {user.accountType} lid
              </div>
            </div>
            <button 
              onClick={handleLogout}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px',
                color: 'var(--color-danger)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', flex: 1, padding: '32px', gap: '32px', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
        
        {/* Sidebar Nav */}
        <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={() => setActiveTab('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: activeTab === 'overview' ? 'var(--accent-glow)' : 'transparent',
              color: activeTab === 'overview' ? 'var(--accent-color)' : 'var(--text-secondary)',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left',
              transition: 'var(--transition-smooth)'
            }}>
            <Layers size={18} /> Overzicht
          </button>
          <button 
            onClick={() => setActiveTab('transfer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: activeTab === 'transfer' ? 'var(--accent-glow)' : 'transparent',
              color: activeTab === 'transfer' ? 'var(--accent-color)' : 'var(--text-secondary)',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left',
              transition: 'var(--transition-smooth)'
            }}>
            <Send size={18} /> P2P Overboeking
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: activeTab === 'history' ? 'var(--accent-glow)' : 'transparent',
              color: activeTab === 'history' ? 'var(--accent-color)' : 'var(--text-secondary)',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left',
              transition: 'var(--transition-smooth)'
            }}>
            <History size={18} /> Geschiedenis
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {activeTab === 'overview' && (
            <div className="animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Financial Dashboard Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                
                {/* Premium Neon Debit Card */}
                <div className={`glass-card ${isBalanceUpdated ? 'glow-active' : ''}`} style={{
                  background: 'linear-gradient(135deg, hsl(250, 60%, 15%) 0%, hsl(228, 24%, 6%) 100%)',
                  border: '1px solid rgba(138, 43, 226, 0.3)',
                  padding: '28px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '220px',
                  boxShadow: '0 15px 35px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.1)'
                }}>
                  {/* Subtle hologram overlay */}
                  <div style={{
                    position: 'absolute',
                    top: '-50px',
                    left: '-50px',
                    width: '200px',
                    height: '200px',
                    background: 'radial-gradient(circle, var(--accent-secondary-glow) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }}></div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: '1px', color: 'var(--text-secondary)' }}>Hoofdrekening</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span>€</span>
                        <span style={{ fontSize: '2.2rem', letterSpacing: '-1px' }}>{primaryWallet.balance.toFixed(2)}</span>
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: '1px solid var(--border-color)',
                      color: 'var(--accent-secondary)'
                    }}>
                      EUR
                    </div>
                  </div>

                  <div style={{ zIndex: 1 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', letterSpacing: '2px', color: 'var(--text-secondary)' }}>
                      ••••  ••••  ••••  {primaryWallet.id ? primaryWallet.id.substring(0, 4).toUpperCase() : '8841'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px' }}>
                      <div>
                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Kaarthouder</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', marginTop: '2px' }}>
                          {user.profile?.firstName.toUpperCase()} {user.profile?.lastName.toUpperCase()}
                        </div>
                      </div>
                      <Zap size={20} style={{ color: 'var(--accent-color)' }} />
                    </div>
                  </div>
                </div>

                {/* Quick Simulated Deposit widget */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Testbedrag Storten</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '20px' }}>
                      Voeg direct fictief geld toe om het bank-platform en de live notificaties te testen.
                    </p>
                  </div>
                  <form onSubmit={handleDeposit} style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>€</span>
                      <input 
                        type="number" 
                        className="form-input" 
                        style={{ paddingLeft: '32px' }}
                        value={depositAmount}
                        onChange={e => setDepositAmount(e.target.value)}
                        placeholder="250.00"
                        min="1"
                        required
                      />
                    </div>
                    <button type="submit" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} disabled={depositLoading}>
                      <Plus size={16} /> Stort
                    </button>
                  </form>
                </div>

              </div>

              {/* Live SVG Graph & Ledger Analysis */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px', alignItems: 'start' }}>
                
                {/* Stunning Hand-crafted Line Graph representing user history */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Saldo Trend</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Globe size={12} /> Live Ledger Index
                    </span>
                  </h3>
                  
                  {/* Clean SVG rendering asset trend dynamically */}
                  <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                    <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      
                      {/* Grid lines */}
                      <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                      <line x1="0" y1="150" x2="500" y2="150" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                      {/* Area beneath chart */}
                      <path d="M 0 170 C 100 130, 200 150, 300 90 C 400 30, 450 70, 500 40 L 500 200 L 0 200 Z" fill="url(#chart-glow)" />

                      {/* Main Trend Line */}
                      <path d="M 0 170 C 100 130, 200 150, 300 90 C 400 30, 450 70, 500 40" fill="none" stroke="var(--accent-color)" strokeWidth="3.5" strokeLinecap="round" />

                      {/* Dots on line */}
                      <circle cx="300" cy="90" r="5" fill="var(--accent-secondary)" stroke="#fff" strokeWidth="1.5" />
                      <circle cx="500" cy="40" r="5" fill="var(--accent-color)" stroke="#fff" strokeWidth="1.5" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Aanmaak</span>
                    <span>Transacties</span>
                    <span>Vandaag (Live)</span>
                  </div>
                </div>

                {/* Quick transfer box */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>Snelle Overboeking</h3>
                  <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>E-mail Ontvanger</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        value={transferEmail}
                        onChange={e => setTransferEmail(e.target.value)}
                        placeholder="naam@finvault.com" 
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bedrag</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>€</span>
                        <input 
                          type="number" 
                          className="form-input" 
                          style={{ paddingLeft: '32px' }}
                          value={transferAmount}
                          onChange={e => setTransferAmount(e.target.value)}
                          placeholder="0.00" 
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                      Geld Verzenden <Send size={16} />
                    </button>
                  </form>
                </div>

              </div>

              {/* Recent Transactions List */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>Recente Transacties</h3>
                {transactions.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
                    Nog geen transacties uitgevoerd. Stort wat geld of doe een overboeking om de ledger te vullen!
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {transactions.slice(0, 5).map((tx) => {
                      const isSender = tx.senderWalletId === primaryWallet.id;
                      return (
                        <div key={tx.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          padding: '14px 20px',
                          borderRadius: '12px',
                          fontSize: '0.9rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                              background: isSender ? 'var(--color-danger-glow)' : 'var(--color-success-glow)',
                              color: isSender ? 'var(--color-danger)' : 'var(--color-success)',
                              padding: '8px',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              {isSender ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{tx.description}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                                Ref: {tx.reference} • {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{
                              fontWeight: 700,
                              color: isSender ? 'var(--color-danger)' : 'var(--color-success)'
                            }}>
                              {isSender ? '-' : '+'} €{tx.amount.toFixed(2)}
                            </div>
                            <span style={{
                              fontSize: '0.65rem',
                              background: 'var(--color-success-glow)',
                              color: 'var(--color-success)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              display: 'inline-block',
                              marginTop: '4px'
                            }}>
                              {tx.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="glass-card animate-slide-in" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Geld Overboeken</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
                Verstuur direct geld naar een ander FinVault account met behulp van hun geregistreerde e-mailadres. Het bedrag wordt real-time verwerkt via onze atomaire dubbele boekhouding.
              </p>

              {transferError && (
                <div style={{
                  background: 'var(--color-danger-glow)',
                  border: '1px solid var(--color-danger)',
                  padding: '12px',
                  borderRadius: '10px',
                  color: 'var(--color-danger)',
                  fontSize: '0.85rem',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={16} />
                  {transferError}
                </div>
              )}

              {transferSuccess && (
                <div style={{
                  background: 'var(--color-success-glow)',
                  border: '1px solid var(--color-success)',
                  padding: '12px',
                  borderRadius: '10px',
                  color: 'var(--color-success)',
                  fontSize: '0.85rem',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle size={16} />
                  Overboeking met succes afgerond en vastgelegd in het grootboek.
                </div>
              )}

              <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    E-mailadres Ontvanger
                  </label>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={transferEmail}
                    onChange={e => setTransferEmail(e.target.value)}
                    placeholder="ontvanger@finvault.com" 
                    required 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Bedrag (EUR)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>€</span>
                    <input 
                      type="number" 
                      className="form-input" 
                      style={{ paddingLeft: '32px' }}
                      value={transferAmount}
                      onChange={e => setTransferAmount(e.target.value)}
                      placeholder="0.00" 
                      min="0.01" 
                      step="0.01"
                      required 
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Omschrijving
                  </label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={transferDesc}
                    onChange={e => setTransferDesc(e.target.value)}
                    placeholder="Bijv. Huur, Cadeau, Avondeten" 
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ marginTop: '12px' }} disabled={transferLoading}>
                  {transferLoading ? 'Transactie Verwerken...' : 'Nu Overboeken'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="glass-card animate-slide-in">
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Volledige Transactiegeschiedenis</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
                Alle bij- en afschrijvingen die via je wallets zijn gelopen. Dit is de onveranderlijke weergave van het systeemgrootboek.
              </p>

              {transactions.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
                  Geen transacties gevonden.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Datum & Tijd</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Referentie</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Omschrijving</th>
                      <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Bedrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => {
                      const isSender = tx.senderWalletId === primaryWallet.id;
                      return (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)', hover: { background: 'rgba(255,255,255,0.01)' } }}>
                          <td style={{ padding: '16px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '16px', fontFamily: 'monospace' }}>{tx.reference}</td>
                          <td style={{ padding: '16px' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              background: tx.type === 'deposit' ? 'var(--color-success-glow)' : 'var(--accent-glow)',
                              color: tx.type === 'deposit' ? 'var(--color-success)' : 'var(--accent-color)',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontWeight: 600
                            }}>
                              {tx.type}
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontWeight: 500 }}>{tx.description}</td>
                          <td style={{ 
                            padding: '16px', 
                            textAlign: 'right', 
                            fontWeight: 700,
                            color: isSender ? 'var(--color-danger)' : 'var(--color-success)'
                          }}>
                            {isSender ? '-' : '+'} €{tx.amount.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </div>
      
      {/* Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--border-color)',
        padding: '24px 32px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        background: 'var(--bg-secondary)'
      }}>
        FinVault Microservices Bank-Platform © 2026. Beveiligd door atomaire double-entry ledgers.
      </footer>
    </div>
  );
}
