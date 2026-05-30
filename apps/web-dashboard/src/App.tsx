import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Send, 
  Plus, 
  History, 
  Layers, 
  LogOut, 
  Bell, 
  CheckCircle, 
  XCircle, 
  Shield, 
  Zap, 
  AlertTriangle,
  Globe,
  Eye,
  EyeOff,
  Copy,
  Check,
  FileText
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
  
  // Phase 2 & 3 States
  const [activeWalletIndex, setActiveWalletIndex] = useState(0);
  const [isIbanVisible, setIsIbanVisible] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [balanceHistory, setBalanceHistory] = useState<any[]>([]);
  const [newWalletType, setNewWalletType] = useState('savings'); // checking or savings
  const [newWalletLoading, setNewWalletLoading] = useState(false);
  const [timeSimulationLoading, setTimeSimulationLoading] = useState(false);
  
  // Realistische Bankflows states
  const [invoiceSubTab, setInvoiceSubTab] = useState<'receipts' | 'requests' | 'mandates'>('receipts');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [mandates, setMandates] = useState<any[]>([]);
  
  // Forms loading/success states
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSuccess, setInvoiceSuccess] = useState(false);

  // Form Inputs
  const [reqRecipient, setReqRecipient] = useState('');
  const [reqAmount, setReqAmount] = useState('');
  const [reqDesc, setReqDesc] = useState('');

  const [mandatePayee, setMandatePayee] = useState('');
  const [mandateAmount, setMandateAmount] = useState('');
  const [mandateDesc, setMandateDesc] = useState('');
  const [mandateInterval, setMandateInterval] = useState('30');
  
  // UI Control State
  const [activeTab, setActiveTab] = useState<'overview' | 'transfer' | 'history' | 'invoices'>('overview');
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
  }, [user, token]);

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
        fetchAllInvoiceData();
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
      email: 'tom@finvault.com',
      accountType: 'personal',
      profile: {
        firstName: 'Tom',
        lastName: 'Bomeke',
        address: 'Antwerpen, België',
        country: 'België'
      }
    };
    setUser(mockUser);
    setWallets([
      {
        id: 'mock-wallet-eur',
        userId: 'mock-user-123',
        iban: 'BE89377007719941',
        currency: 'EUR',
        type: 'checking',
        interestRate: 0.0,
        balance: 1450.50,
        reservedBalance: 0.0,
        status: 'active',
        creditLine: {
          creditLimit: 1000.0,
          usedCredit: 0.0,
          interestRate: 0.15,
          status: 'active'
        }
      },
      {
        id: 'mock-wallet-savings',
        userId: 'mock-user-123',
        iban: 'BE89377007718822',
        currency: 'EUR',
        type: 'savings',
        interestRate: 0.025,
        balance: 5000.00,
        reservedBalance: 0.0,
        status: 'active'
      }
    ]);
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
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
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
    setBalanceHistory([
      { id: '1', walletId: 'mock-wallet-eur', amount: 1200.50, balanceAfter: 1200.50, reason: 'Salaris storting', timestamp: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: '2', walletId: 'mock-wallet-eur', amount: 250.00, balanceAfter: 1450.50, reason: 'Welkomstbonus', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: '3', walletId: 'mock-wallet-eur', amount: -4.80, balanceAfter: 1445.70, reason: 'Starbucks Antwerpen', timestamp: new Date(Date.now() - 3600000).toISOString() }
    ]);
    setWsStatus('connected');
    addNotification('Demo Simulator Actief', 'De API Gateway is offline. FinVault draait in offline demonstratiemodus.', 'warning');
    fetchAllInvoiceData();
  };

  const fetchBalanceHistory = async (walletId: string) => {
    if (!walletId) return;
    if (walletId.startsWith('mock-')) return;
    try {
      const res = await fetch(`/api/wallets/${walletId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBalanceHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch balance history:', err);
    }
  };

  useEffect(() => {
    if (wallets.length > 0 && wallets[activeWalletIndex]) {
      fetchBalanceHistory(wallets[activeWalletIndex].id);
    }
  }, [wallets, activeWalletIndex]);

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewWalletLoading(true);

    try {
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: newWalletType })
      });

      const data = await res.json();
      if (res.ok) {
        const typeName = newWalletType === 'savings' ? 'Spaarrekening' : 'Betaalrekening';
        addNotification('Nieuwe Rekening Geopend', `Je ${typeName} is succesvol geopend met IBAN ${data.iban}`, 'success');
        fetchWallets();
      } else {
        addNotification('Rekening Fout', data.error || 'Kon rekening niet aanmaken.', 'warning');
      }
    } catch {
      // Mock creation fallback for demo
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
      const startBonus = newWalletType === 'savings' ? 50.00 : 100.00;
      const mockNew = {
        id: `mock-wallet-${newWalletType}-${Math.random().toString(36).substring(2, 5)}`,
        userId: user ? user.id : 'mock-user-123',
        iban: `BE8937700771${randomDigits}`,
        currency: 'EUR',
        type: newWalletType,
        interestRate: newWalletType === 'savings' ? 0.025 : 0.0,
        balance: startBonus,
        reservedBalance: 0.0,
        status: 'active'
      };
      setWallets(prev => [...prev, mockNew]);
      setBalanceHistory(prev => [
        ...prev,
        { id: Math.random().toString(), walletId: mockNew.id, amount: startBonus, balanceAfter: startBonus, reason: newWalletType === 'savings' ? 'Spaarrekening Geopend (Bonus)' : 'Betaalrekening Geopend (Bonus)', timestamp: new Date().toISOString() }
      ]);
      const typeName = newWalletType === 'savings' ? 'Spaarrekening' : 'Betaalrekening';
      addNotification('Nieuwe Rekening Geopend (Demo)', `Je ${typeName} is succesvol geopend met IBAN ${mockNew.iban} in demonstratiemodus.`, 'success');
    } finally {
      setNewWalletLoading(false);
    }
  };

  const fetchReceipts = async () => {
    if (!token || token === 'mock-token-abc') {
      setReceipts([
        {
          id: 'receipt-1',
          transactionRef: 'DEP-MOCK123',
          payerUserId: 'EXTERNAL',
          payeeUserId: user ? user.id : 'mock-user-123',
          payerEmail: 'cash-deposit@finvault.com',
          payeeEmail: user ? user.email : 'tom@finvault.com',
          amount: 250.00,
          currency: 'EUR',
          description: 'Cash Deposit Welkomstbonus',
          pdfPath: null,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
          id: 'receipt-2',
          transactionRef: 'TX-MOCK456',
          payerUserId: user ? user.id : 'mock-user-123',
          payeeUserId: 'some-other-id',
          payerEmail: user ? user.email : 'tom@finvault.com',
          payeeEmail: 'billing@tombomeke-studios.com',
          amount: 29.99,
          currency: 'EUR',
          description: 'Automatische Incasso: VPS Cloud Hosting',
          pdfPath: null,
          createdAt: new Date().toISOString()
        }
      ]);
      return;
    }
    try {
      const res = await fetch('/api/invoices/receipts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReceipts(data);
      }
    } catch (err) {
      console.error('Failed to fetch receipts:', err);
    }
  };

  const fetchPaymentRequests = async () => {
    if (!token || token === 'mock-token-abc') {
      setPaymentRequests([
        {
          id: 'req-1',
          creatorUserId: 'some-other-id',
          creatorEmail: 'colleague@company.com',
          recipientEmail: user ? user.email : 'tom@finvault.com',
          amount: 15.50,
          currency: 'EUR',
          description: 'Koffie voor kantoor',
          status: 'pending',
          paidAt: null,
          transactionRef: null,
          createdAt: new Date().toISOString()
        },
        {
          id: 'req-2',
          creatorUserId: user ? user.id : 'mock-user-123',
          creatorEmail: user ? user.email : 'tom@finvault.com',
          recipientEmail: 'client@company.com',
          amount: 150.00,
          currency: 'EUR',
          description: 'Gezamenlijk Diner Project',
          status: 'paid',
          paidAt: new Date().toISOString(),
          transactionRef: 'TX-PAYREQ88',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]);
      return;
    }
    try {
      const res = await fetch('/api/invoices/payment-requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentRequests(data);
      }
    } catch (err) {
      console.error('Failed to fetch payment requests:', err);
    }
  };

  const fetchMandates = async () => {
    if (!token || token === 'mock-token-abc') {
      setMandates([
        {
          id: 'mandate-1',
          payerUserId: user ? user.id : 'mock-user-123',
          payerEmail: user ? user.email : 'tom@finvault.com',
          payeeUserId: 'hosting-id',
          payeeEmail: 'billing@tombomeke-studios.com',
          amount: 29.99,
          currency: 'EUR',
          description: 'VPS Cloud Hosting (Maandelijks)',
          intervalDays: 30,
          status: 'active',
          nextChargeAt: new Date(Date.now() + 86400000 * 15).toISOString(),
          lastChargedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
          totalCharged: 59.98,
          chargeCount: 2,
          createdAt: new Date(Date.now() - 86400000 * 45).toISOString()
        }
      ]);
      return;
    }
    try {
      const res = await fetch('/api/invoices/mandates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMandates(data);
      }
    } catch (err) {
      console.error('Failed to fetch mandates:', err);
    }
  };

  const fetchAllInvoiceData = () => {
    fetchReceipts();
    fetchPaymentRequests();
    fetchMandates();
  };

  const handleDownloadPdf = async (receiptId: string, transactionRef: string) => {
    if (!token || token === 'mock-token-abc') {
      addNotification('PDF Gedownload (Demo)', 'Kwitantie PDF gedownload in demonstratiemodus.', 'success');
      return;
    }
    try {
      const res = await fetch(`/api/invoices/receipts/${receiptId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Kwitantie_${transactionRef}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        addNotification('Download Voltooid', 'Je PDF-kwitantie is succesvol gedownload.', 'success');
      } else {
        addNotification('Download Mislukt', 'Kan de PDF-kwitantie op dit moment niet ophalen.', 'warning');
      }
    } catch (err) {
      console.error('Failed to download PDF:', err);
      addNotification('Fout bij download', 'Er is een fout opgetreden bij het downloaden van de PDF.', 'warning');
    }
  };

  const handleCreatePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvoiceLoading(true);
    setInvoiceError('');
    setInvoiceSuccess(false);

    const amt = parseFloat(reqAmount);
    if (isNaN(amt) || amt <= 0) {
      setInvoiceError('Voer een geldig bedrag in.');
      setInvoiceLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/invoices/payment-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientEmail: reqRecipient,
          amount: amt,
          description: reqDesc
        })
      });

      const data = await res.json();
      if (res.ok) {
        setInvoiceSuccess(true);
        setReqRecipient('');
        setReqAmount('');
        setReqDesc('');
        addNotification('Verzoek Verzonden', `Betalingsverzoek voor €${amt.toFixed(2)} verzonden naar ${reqRecipient}`, 'success');
        fetchPaymentRequests();
      } else {
        setInvoiceError(data.error || 'Kon betalingsverzoek niet aanmaken.');
      }
    } catch {
      const mockReq = {
        id: `mock-req-${Math.random().toString(36).substring(2, 6)}`,
        creatorUserId: user ? user.id : 'mock-user-123',
        creatorEmail: user ? user.email : 'premium-user@finvault.com',
        recipientEmail: reqRecipient,
        amount: amt,
        currency: 'EUR',
        description: reqDesc,
        status: 'pending',
        paidAt: null,
        transactionRef: null,
        createdAt: new Date().toISOString()
      };
      setPaymentRequests(prev => [mockReq, ...prev]);
      setInvoiceSuccess(true);
      setReqRecipient('');
      setReqAmount('');
      setReqDesc('');
      addNotification('Verzoek Verzonden (Demo)', `Betalingsverzoek voor €${amt.toFixed(2)} verzonden in offline demo modus.`, 'success');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handlePayPaymentRequest = async (reqId: string) => {
    try {
      const res = await fetch(`/api/invoices/payment-requests/${reqId}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok) {
        addNotification('Verzoek Voldaan', 'Betalingsverzoek succesvol voldaan.', 'success');
        fetchPaymentRequests();
        fetchWallets();
        fetchTransactions();
        fetchReceipts();
      } else {
        addNotification('Betaling Mislukt', data.error || 'Kon het verzoek niet voldoen.', 'warning');
      }
    } catch {
      const request = paymentRequests.find(r => r.id === reqId);
      if (!request) return;

      const checkingWalletIndex = wallets.findIndex(w => w.type === 'checking');
      const checkingWallet = wallets[checkingWalletIndex >= 0 ? checkingWalletIndex : 0];

      if (checkingWallet.balance < request.amount) {
        addNotification('Saldo Tekort', 'Onvoldoende saldo op je Betaalrekening.', 'warning');
        return;
      }

      const newBal = parseFloat((checkingWallet.balance - request.amount).toFixed(2));
      setWallets(prev => prev.map((w, idx) => idx === (checkingWalletIndex >= 0 ? checkingWalletIndex : 0) ? { ...w, balance: newBal } : w));
      
      const newTx = {
        id: Math.random().toString(),
        reference: `REQ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        senderWalletId: checkingWallet.id,
        receiverWalletId: null,
        amount: request.amount,
        currency: 'EUR',
        status: 'confirmed',
        type: 'transfer',
        description: `Betaling verzoek: ${request.description}`,
        createdAt: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);

      setPaymentRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'paid', paidAt: new Date().toISOString(), transactionRef: newTx.reference } : r));
      addNotification('Verzoek Voldaan (Demo)', `€${request.amount.toFixed(2)} overgemaakt via offline simulator.`, 'success');
      fetchReceipts();
    }
  };

  const handleDeclinePaymentRequest = async (reqId: string) => {
    try {
      const res = await fetch(`/api/invoices/payment-requests/${reqId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        addNotification('Verzoek Geweigerd', 'Je hebt het betalingsverzoek geweigerd.', 'info');
        fetchPaymentRequests();
      }
    } catch {
      setPaymentRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'declined' } : r));
      addNotification('Verzoek Geweigerd (Demo)', 'Verzoek gemarkeerd als geweigerd.', 'info');
    }
  };

  const handleCreateMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvoiceLoading(true);
    setInvoiceError('');
    setInvoiceSuccess(false);

    const amt = parseFloat(mandateAmount);
    if (isNaN(amt) || amt <= 0) {
      setInvoiceError('Voer een geldig bedrag in.');
      setInvoiceLoading(false);
      return;
    }

    const intervalVal = parseInt(mandateInterval, 10);
    if (isNaN(intervalVal) || intervalVal <= 0) {
      setInvoiceError('Voer een geldige frequentie in.');
      setInvoiceLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/invoices/mandates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payeeEmail: mandatePayee,
          amount: amt,
          description: mandateDesc,
          intervalDays: intervalVal
        })
      });

      const data = await res.json();
      if (res.ok) {
        setInvoiceSuccess(true);
        setMandatePayee('');
        setMandateAmount('');
        setMandateDesc('');
        setMandateInterval('30');
        addNotification('Mandaat Actief', `Automatische incasso ingesteld voor €${amt.toFixed(2)} naar ${mandatePayee}`, 'success');
        fetchMandates();
      } else {
        setInvoiceError(data.error || 'Kon automatische incasso niet instellen.');
      }
    } catch {
      const mockMandate = {
        id: `mock-mnd-${Math.random().toString(36).substring(2, 6)}`,
        payerUserId: user ? user.id : 'mock-user-123',
        payerEmail: user ? user.email : 'premium-user@finvault.com',
        payeeUserId: 'some-other-id',
        payeeEmail: mandatePayee,
        amount: amt,
        currency: 'EUR',
        description: mandateDesc,
        intervalDays: intervalVal,
        status: 'active',
        nextChargeAt: new Date(Date.now() + intervalVal * 24 * 60 * 60 * 1000).toISOString(),
        lastChargedAt: null,
        totalCharged: 0.0,
        chargeCount: 0,
        createdAt: new Date().toISOString()
      };
      setMandates(prev => [mockMandate, ...prev]);
      setInvoiceSuccess(true);
      setMandatePayee('');
      setMandateAmount('');
      setMandateDesc('');
      setMandateInterval('30');
      addNotification('Mandaat Actief (Demo)', `Mandaat voor €${amt.toFixed(2)} aangemaakt in offline demo modus.`, 'success');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleCancelMandate = async (mandateId: string) => {
    try {
      const res = await fetch(`/api/invoices/mandates/${mandateId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        addNotification('Mandaat Geannuleerd', 'De automatische incasso is geannuleerd.', 'info');
        fetchMandates();
      }
    } catch {
      setMandates(prev => prev.map(m => m.id === mandateId ? { ...m, status: 'cancelled' } : m));
      addNotification('Mandaat Geannuleerd (Demo)', 'Mandaat gemarkeerd als geannuleerd.', 'info');
    }
  };

  const handleSimulateTime = async (months: number) => {
    setTimeSimulationLoading(true);

    try {
      const res = await fetch('/api/wallets/simulate-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ months })
      });

      const data = await res.json();
      if (res.ok) {
        let renteTotal = 0;
        if (data.updatedAccounts && data.updatedAccounts.length > 0) {
          renteTotal = data.updatedAccounts.reduce((acc: number, curr: any) => acc + curr.interestEarned, 0);
        }
        addNotification(
          'Tijd Versneld',
          `Tijd met ${months} maanden vooruitgespoeld! Totaal ontvangen rente op spaarrekeningen: €${renteTotal.toFixed(2)}`,
          'success'
        );
        fetchWallets();
        fetchTransactions();
        fetchAllInvoiceData();
      } else {
        addNotification('Simulatie Fout', data.error || 'Kon tijd niet simuleren.', 'warning');
      }
    } catch {
      // Mock simulation fallback
      let interestTotal = 0;
      setWallets(prev => prev.map(w => {
        if (w.type === 'savings' && w.interestRate > 0) {
          const interest = parseFloat((w.balance * w.interestRate * (months / 12)).toFixed(2));
          interestTotal += interest;
          const newBal = parseFloat((w.balance + interest).toFixed(2));
          
          // Seed mock history
          setBalanceHistory(hist => [
            ...hist,
            { id: Math.random().toString(), walletId: w.id, amount: interest, balanceAfter: newBal, reason: `Rente-opbouw (${months} mnd @ ${(w.interestRate * 100).toFixed(1)}%)`, timestamp: new Date().toISOString() }
          ]);
          
          return { ...w, balance: newBal };
        }
        return w;
      }));

      addNotification(
        'Tijd Versneld (Demo)',
        `Tijd met ${months} maanden vooruitgespoeld in demonstratiemodus! Ontvangen rente: €${interestTotal.toFixed(2)}`,
        'success'
      );
    } finally {
      setTimeSimulationLoading(false);
    }
  };

  const handleUpdateCreditLine = async (limit: number, status: string) => {
    const currentWallet = wallets[activeWalletIndex];
    if (!currentWallet || currentWallet.type !== 'checking') return;

    if (!token || token === 'mock-token-abc') {
      // Mock update for offline demo mode
      const updatedCreditLine = {
        creditLimit: limit,
        usedCredit: currentWallet.creditLine ? currentWallet.creditLine.usedCredit : 0.0,
        interestRate: 0.15,
        status: status
      };
      setWallets(prev => prev.map((w, idx) => idx === activeWalletIndex ? { ...w, creditLine: updatedCreditLine } : w));
      addNotification('Kredietlimiet Aangepast (Demo)', `Kredietlimiet ingesteld op €${limit.toFixed(2)} (${status})`, 'success');
      return;
    }

    try {
      const res = await fetch(`/api/wallets/${currentWallet.id}/credit-line`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          creditLimit: limit,
          status: status
        })
      });

      if (res.ok) {
        const data = await res.json();
        addNotification('Kredietlimiet Bijgewerkt', `Je kredietlimiet is ingesteld op €${limit.toFixed(2)}. Status: ${status}`, 'success');
        fetchWallets();
      } else {
        const data = await res.json();
        addNotification('Fout bij limiet', data.error || 'Kon kredietlimiet niet bijwerken.', 'warning');
      }
    } catch (err) {
      console.error('Failed to update credit line:', err);
    }
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
    if (wallets.length === 0) {
      setTransferError('Geen actieve rekeningen gevonden.');
      return;
    }
    
    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess(false);

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setTransferError('Voer een geldig bedrag in.');
      setTransferLoading(false);
      return;
    }

    const currentWallet = wallets[activeWalletIndex];

    // Direct client validation
    if (currentWallet.balance < amountNum) {
      setTransferError(`Onvoldoende saldo op je geselecteerde rekening.`);
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
          senderWalletId: currentWallet.id,
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
      const mockWallet = currentWallet;
      const newBal = mockWallet.balance - amountNum;
      setWallets(prev => prev.map((w, idx) => idx === activeWalletIndex ? { ...w, balance: newBal } : w));
      
      const newTx = {
        id: Math.random().toString(),
        reference: `TX-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        senderWalletId: mockWallet.id,
        receiverWalletId: null,
        amount: amountNum,
        currency: mockWallet.currency,
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
    if (wallets.length === 0) {
      addNotification('Fout', 'Geen actieve rekeningen om op te storten.', 'warning');
      return;
    }
    
    setDepositLoading(true);
    const amountNum = parseFloat(depositAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setDepositLoading(false);
      addNotification('Fout', 'Voer een geldig bedrag in om te storten.', 'warning');
      return;
    }

    const currentWallet = wallets[activeWalletIndex];

    try {
      const res = await fetch('/api/wallets/deposit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          walletId: currentWallet.id,
          amount: amountNum
        })
      });

      if (res.ok) {
        setDepositAmount('');
        addNotification('Saldo Gestort', `€${amountNum.toFixed(2)} toegevoegd via simulator.`, 'success');
        fetchWallets();
        fetchTransactions();
      } else {
        const data = await res.json();
        addNotification('Storting Mislukt', data.error || 'Er is een fout opgetreden bij het storten.', 'warning');
      }
    } catch {
      // Mock deposit
      const mockWallet = currentWallet;
      const newBal = mockWallet.balance + amountNum;
      setWallets(prev => prev.map((w, idx) => idx === activeWalletIndex ? { ...w, balance: newBal } : w));
      
      const newTx = {
        id: Math.random().toString(),
        reference: `DEP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        senderWalletId: null,
        receiverWalletId: mockWallet.id,
        amount: amountNum,
        currency: mockWallet.currency,
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

  const activeWallet = wallets[activeWalletIndex] || { balance: 0.0, currency: 'EUR', id: '', iban: '' };

  const formatIban = (iban: string, visible: boolean) => {
    if (!iban) return 'BE89 •••• •••• ••••';
    const clean = iban.replace(/\s+/g, '');
    if (visible) {
      return clean.replace(/(.{4})/g, '$1 ').trim();
    } else {
      if (clean.length >= 16) {
        return `${clean.substring(0, 4)} •••• •••• ${clean.substring(clean.length - 4)}`;
      }
      return 'BE89 •••• •••• ••••';
    }
  };

  const currencySigns: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    CHF: '₣'
  };
  const curSign = currencySigns[activeWallet.currency] || '€';

  const renderTrendGraph = () => {
    if (!balanceHistory || balanceHistory.length === 0) {
      return {
        lineD: "M 0 140 L 500 140",
        areaD: "M 0 140 L 500 140 L 500 200 L 0 200 Z",
        points: []
      };
    }

    const balances = balanceHistory.map(h => h.balanceAfter);
    const minBal = Math.min(...balances, 0); 
    const maxBal = Math.max(...balances, 10); 
    const balRange = maxBal - minBal || 1;

    const pts = balanceHistory.map((item, index) => {
      const x = balanceHistory.length === 1 ? 250 : (index / (balanceHistory.length - 1)) * 500;
      const y = 170 - ((item.balanceAfter - minBal) / balRange) * 140; 
      return {
        x,
        y,
        balance: item.balanceAfter,
        reason: item.reason,
        date: new Date(item.timestamp || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })
      };
    });

    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = pts.length > 0 ? `${lineD} L ${pts[pts.length - 1].x} 200 L ${pts[0].x} 200 Z` : '';

    return { lineD, areaD, points: pts };
  };

  const { lineD, areaD, points } = renderTrendGraph();

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
              <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                <span 
                  className={`status-led ${wsStatus}`} 
                  title={`Gateway: ${wsStatus === 'connected' ? 'ONLINE' : wsStatus === 'connecting' ? 'SYNCING' : 'OFFLINE'}`}
                />
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
            onClick={() => setActiveTab('invoices')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: activeTab === 'invoices' ? 'var(--accent-glow)' : 'transparent',
              color: activeTab === 'invoices' ? 'var(--accent-color)' : 'var(--text-secondary)',
              border: 'none',
              padding: '12px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              textAlign: 'left',
              transition: 'var(--transition-smooth)'
            }}>
            <FileText size={18} /> Facturen
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                
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
                  minHeight: '220px',
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
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)' }}>
                        {activeWallet.type === 'savings' ? 'Spaarrekening' : 'Betaalrekening'}
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span>€</span>
                        <span style={{ fontSize: '2.2rem', letterSpacing: '-1px' }}>{activeWallet.balance.toFixed(2)}</span>
                      </div>
                      {activeWallet.type === 'checking' && activeWallet.creditLine && activeWallet.creditLine.status !== 'inactive' && (
                        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Krediet</span>
                            <span style={{ fontWeight: 600, color: '#fff' }}>€{activeWallet.creditLine.creditLimit.toFixed(2)}</span>
                          </div>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Gebruikt</span>
                            <span style={{ fontWeight: 600, color: activeWallet.creditLine.usedCredit > 0 ? 'var(--color-danger)' : '#fff' }}>
                              €{activeWallet.creditLine.usedCredit.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Bestedingsruimte</span>
                            <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                              €{(activeWallet.balance + activeWallet.creditLine.creditLimit - activeWallet.creditLine.usedCredit).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: '1px solid var(--border-color)',
                      color: activeWallet.type === 'savings' ? '#ffb703' : 'var(--accent-secondary)'
                    }}>
                      {activeWallet.type === 'savings' ? '2.5% Rente' : 'Checking'}
                    </div>
                  </div>

                  <div style={{ zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: '1.5px', color: 'var(--text-secondary)' }}>
                        {formatIban(activeWallet.iban, isIbanVisible)}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsIbanVisible(!isIbanVisible);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'var(--transition-smooth)'
                          }}
                          title={isIbanVisible ? "IBAN verbergen" : "IBAN tonen"}
                        >
                          {isIbanVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeWallet.iban) {
                              navigator.clipboard.writeText(activeWallet.iban);
                              setCopyFeedback(true);
                              setTimeout(() => setCopyFeedback(false), 2000);
                              addNotification('Gekopieerd', 'IBAN is gekopieerd naar het klembord!', 'success');
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'var(--transition-smooth)',
                            position: 'relative'
                          }}
                          title="Kopieer IBAN"
                        >
                          {copyFeedback ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Copy size={14} />}
                          {copyFeedback && <span className="copy-tooltip">Gekopieerd!</span>}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px' }}>
                      <div>
                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Kaarthouder</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', marginTop: '2px' }}>
                          {user.profile?.firstName?.toUpperCase()} {user.profile?.lastName?.toUpperCase()}
                        </div>
                      </div>
                      <Zap size={20} style={{ color: 'var(--accent-color)' }} />
                    </div>
                  </div>
                </div>

                {/* Quick Simulated Deposit widget */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '220px' }}>
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

                {/* Rekeningen & Sparen Card */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '220px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Rekeningen & Sparen</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '90px', overflowY: 'auto', marginBottom: '8px', paddingRight: '4px' }}>
                      {wallets.map((w, idx) => {
                        const isActive = idx === activeWalletIndex;
                        const isSavings = w.type === 'savings';
                        return (
                          <div 
                            key={w.id} 
                            onClick={() => {
                              setActiveWalletIndex(idx);
                              setIsIbanVisible(false);
                            }}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: isActive ? 'var(--accent-glow)' : 'rgba(255,255,255,0.02)',
                              border: isActive 
                                ? `1px solid ${isSavings ? '#ffb703' : 'var(--accent-color)'}` 
                                : '1px solid var(--border-color)',
                              boxShadow: isActive ? `0 0 10px ${isSavings ? 'rgba(255,183,3,0.15)' : 'rgba(138,43,226,0.15)'}` : 'none',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              transition: 'var(--transition-smooth)'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                              <span style={{ fontWeight: 600, color: isActive ? (isSavings ? '#ffb703' : 'var(--accent-color)') : '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isSavings ? 'Spaarrekening' : 'Betaalrekening'}
                                {isSavings && <span style={{ fontSize: '0.65rem', background: 'rgba(255,183,3,0.15)', color: '#ffb703', padding: '1px 4px', borderRadius: '4px' }}>2.5%</span>}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                {w.iban ? `${w.iban.substring(0, 4)}...${w.iban.substring(w.iban.length - 4)}` : ''}
                              </span>
                            </div>
                            <span style={{ fontWeight: 700 }}>
                              €{w.balance.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <form onSubmit={handleCreateWallet} style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <select
                      value={newWalletType}
                      onChange={e => setNewWalletType(e.target.value)}
                      className="form-input"
                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', height: '34px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}
                      disabled={newWalletLoading}
                    >
                      <option value="checking" style={{ background: 'var(--bg-secondary)', color: '#fff' }}>Extra Betaalrekening</option>
                      <option value="savings" style={{ background: 'var(--bg-secondary)', color: '#fff' }}>Nieuwe Spaarrekening</option>
                    </select>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '0 12px', height: '34px', whiteSpace: 'nowrap' }}
                      disabled={newWalletLoading}
                    >
                      {newWalletLoading ? '...' : '+ Openen'}
                    </button>
                  </form>
                </div>

                {/* Tijd Simulator Widget */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '220px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Zap size={18} style={{ color: '#ffb703' }} /> Tijd Simulator
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                      Versnel de tijd om de rente-opbouw (2,5% p.j.) op spaarrekeningen direct bij te schrijven.
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleSimulateTime(1)} 
                        className="btn-secondary" 
                        style={{ flex: 1, fontSize: '0.75rem', padding: '8px', border: '1px solid var(--border-color)' }} 
                        disabled={timeSimulationLoading}
                      >
                        +1 Mnd
                      </button>
                      <button 
                        onClick={() => handleSimulateTime(6)} 
                        className="btn-secondary" 
                        style={{ flex: 1, fontSize: '0.75rem', padding: '8px', border: '1px solid var(--border-color)' }} 
                        disabled={timeSimulationLoading}
                      >
                        +6 Mnd
                      </button>
                      <button 
                        onClick={() => handleSimulateTime(12)} 
                        className="btn-primary" 
                        style={{ flex: 1, fontSize: '0.75rem', padding: '8px', background: 'var(--accent-color)' }} 
                        disabled={timeSimulationLoading}
                      >
                        +1 Jaar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Credit Line Management Widget (Checking Wallets Only) */}
                {activeWallet.type === 'checking' && (
                  <div className="glass-card animate-slide-in" style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between', 
                    height: '220px',
                    border: '1px solid rgba(0, 230, 118, 0.2)' 
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Shield size={18} style={{ color: 'var(--color-success)' }} /> Overdraft / Roodstand
                        </h3>
                        <span style={{
                          fontSize: '0.65rem',
                          background: activeWallet.creditLine && activeWallet.creditLine.status === 'active' 
                            ? 'rgba(0, 230, 118, 0.15)' 
                            : activeWallet.creditLine && activeWallet.creditLine.status === 'suspended'
                            ? 'rgba(255, 53, 104, 0.15)'
                            : 'rgba(255, 255, 255, 0.05)',
                          color: activeWallet.creditLine && activeWallet.creditLine.status === 'active'
                            ? 'var(--color-success)'
                            : activeWallet.creditLine && activeWallet.creditLine.status === 'suspended'
                            ? 'var(--color-danger)'
                            : 'var(--text-secondary)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {activeWallet.creditLine ? activeWallet.creditLine.status : 'inactive'}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                        Activeer of wijzig je kredietlimiet (roodstand) tot €5.000 om flexibel te kunnen betalen (15% rente p.j. bij roodstand).
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(!activeWallet.creditLine || activeWallet.creditLine.status === 'inactive') ? (
                        <button 
                          onClick={() => handleUpdateCreditLine(500, 'active')}
                          className="btn-primary"
                          style={{ background: 'linear-gradient(135deg, #00e676 0%, #00b0ff 100%)', border: 'none', width: '100%' }}
                        >
                          Activeer €500.00 Kredietlimiet
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>€</span>
                            <select
                              value={activeWallet.creditLine.creditLimit}
                              onChange={(e) => handleUpdateCreditLine(parseFloat(e.target.value), activeWallet.creditLine.status)}
                              className="form-input"
                              style={{ paddingLeft: '32px', height: '38px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}
                            >
                              <option value="500">500.00</option>
                              <option value="1000">1000.00</option>
                              <option value="2500">2500.00</option>
                              <option value="5000">5000.00</option>
                            </select>
                          </div>
                          <button
                            onClick={() => handleUpdateCreditLine(0, 'inactive')}
                            className="btn-secondary"
                            style={{ color: 'var(--color-danger)', borderColor: 'rgba(255, 53, 104, 0.3)', height: '38px', padding: '0 12px' }}
                          >
                            Deactiveren
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                      <path d={areaD} fill="url(#chart-glow)" />

                      {/* Main Trend Line */}
                      <path d={lineD} fill="none" stroke="var(--accent-color)" strokeWidth="3.5" strokeLinecap="round" />

                      {/* Dots on line */}
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle 
                            cx={p.x} 
                            cy={p.y} 
                            r={i === points.length - 1 ? "6" : "4"} 
                            fill={i === points.length - 1 ? "var(--accent-secondary)" : "var(--accent-color)"} 
                            stroke="#fff" 
                            strokeWidth="1.5" 
                          />
                          <title>{`${p.reason}: ${curSign}${p.balance.toFixed(2)} (${p.date})`}</title>
                        </g>
                      ))}
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bedrag</label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Limiet: €{activeWallet.balance.toFixed(2)}
                        </span>
                      </div>
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

                    {transferError && (
                      <div style={{
                        background: 'var(--color-danger-glow)',
                        border: '1px solid var(--color-danger)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        color: 'var(--color-danger)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <AlertTriangle size={14} />
                        <span style={{ flex: 1 }}>{transferError}</span>
                      </div>
                    )}

                    {transferSuccess && (
                      <div style={{
                        background: 'var(--color-success-glow)',
                        border: '1px solid var(--color-success)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        color: 'var(--color-success)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <CheckCircle size={14} />
                        <span>Overboeking geslaagd!</span>
                      </div>
                    )}

                    <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={transferLoading}>
                      {transferLoading ? 'Verzenden...' : 'Geld Verzenden'} <Send size={16} />
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
                      const isSender = tx.senderWalletId && wallets.some(w => w.id === tx.senderWalletId);
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
                              {isSender ? '-' : '+'} {currencySigns[tx.currency] || '€'}{tx.amount.toFixed(2)}
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
      
                    {/* Saldo Limiet Indicator */}
                    <div style={{ 
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Geselecteerde rekening: <strong style={{ color: '#fff' }}>{activeWallet.type === 'savings' ? 'Spaarrekening' : 'Betaalrekening'}</strong>
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>
                          Beschikbaar Saldo: €{activeWallet.balance.toFixed(2)}
                        </span>
                      </div>
                      {activeWallet.type === 'checking' && activeWallet.creditLine && activeWallet.creditLine.status !== 'inactive' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Overdraft Kredietlimiet: <span style={{ color: '#fff', fontWeight: 600 }}>€{activeWallet.creditLine.creditLimit.toFixed(2)}</span> (Opgenomen: €{activeWallet.creditLine.usedCredit.toFixed(2)})
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-success)' }}>
                            Totale Bestedingsruimte: €{(activeWallet.balance + activeWallet.creditLine.creditLimit - activeWallet.creditLine.usedCredit).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
      
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
                      const isSender = tx.senderWalletId && wallets.some(w => w.id === tx.senderWalletId);
                      return (
                        <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
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

          {activeTab === 'invoices' && (
            <div className="animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header and Sub-tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '4px' }}>Facturen & Bankflows</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Beheer je kwitanties, betalingsverzoeken (Tikkie) en automatische incasso's.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <button 
                    onClick={() => setInvoiceSubTab('receipts')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: 'none',
                      background: invoiceSubTab === 'receipts' ? 'var(--accent-glow)' : 'transparent',
                      color: invoiceSubTab === 'receipts' ? 'var(--accent-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Kwitanties
                  </button>
                  <button 
                    onClick={() => setInvoiceSubTab('requests')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: 'none',
                      background: invoiceSubTab === 'requests' ? 'var(--accent-glow)' : 'transparent',
                      color: invoiceSubTab === 'requests' ? 'var(--accent-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Betalingsverzoeken
                  </button>
                  <button 
                    onClick={() => setInvoiceSubTab('mandates')}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: 'none',
                      background: invoiceSubTab === 'mandates' ? 'var(--accent-glow)' : 'transparent',
                      color: invoiceSubTab === 'mandates' ? 'var(--accent-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Automatische Incasso
                  </button>
                </div>
              </div>

              {invoiceSubTab === 'receipts' && (
                <div className="glass-card animate-slide-in">
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={20} style={{ color: 'var(--accent-color)' }} /> Officiële Transactiebewijzen
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
                    Hieronder vind je de automatisch gegenereerde cryptografisch getekende PDF kwitanties van al je bij- en afschrijvingen.
                  </p>

                  {receipts.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '36px 0' }}>
                      Nog geen kwitanties beschikbaar. Voer een transactie uit om er een te genereren.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {receipts.map(rec => {
                        const isPayer = rec.payerUserId === (user ? user.id : 'mock-user-123') || rec.payerEmail === (user ? user.email : 'tom@finvault.com');
                        return (
                          <div key={rec.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(255, 255, 255, 0.01)',
                            border: '1px solid var(--border-color)',
                            padding: '16px 20px',
                            borderRadius: '12px',
                            fontSize: '0.9rem'
                          }}>
                            <div>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{rec.description}</span>
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontFamily: 'monospace',
                                  background: 'rgba(255,255,255,0.05)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  color: 'var(--text-muted)'
                                }}>
                                  {rec.transactionRef}
                                </span>
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                                Van: <span style={{ color: 'var(--text-secondary)' }}>{rec.payerEmail}</span> • Aan: <span style={{ color: 'var(--text-secondary)' }}>{rec.payeeEmail || 'Externe Deposit'}</span> • Datum: {new Date(rec.createdAt).toLocaleString()}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 700, color: isPayer ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                  {isPayer ? '-' : '+'} €{rec.amount.toFixed(2)}
                                </div>
                              </div>
                              
                              <button 
                                onClick={() => handleDownloadPdf(rec.id, rec.transactionRef)}
                                className="btn-secondary"
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <ArrowDownLeft size={14} /> PDF Kwitantie
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {invoiceSubTab === 'requests' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', alignItems: 'start' }}>
                  
                  {/* Create Payment Request Card */}
                  <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Verzoek Aanmaken</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '20px' }}>
                      Stuur een Tikkie-achtig betalingsverzoek naar een andere FinVault gebruiker via e-mail.
                    </p>

                    {invoiceError && (
                      <div style={{
                        background: 'var(--color-danger-glow)',
                        border: '1px solid var(--color-danger)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        color: 'var(--color-danger)',
                        fontSize: '0.8rem',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <AlertTriangle size={16} />
                        <span style={{ flex: 1 }}>{invoiceError}</span>
                      </div>
                    )}

                    {invoiceSuccess && (
                      <div style={{
                        background: 'var(--color-success-glow)',
                        border: '1px solid var(--color-success)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        color: 'var(--color-success)',
                        fontSize: '0.8rem',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <CheckCircle size={16} />
                        <span>Betalingsverzoek succesvol verzonden!</span>
                      </div>
                    )}

                    <form onSubmit={handleCreatePaymentRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>E-mail Ontvanger</label>
                        <input 
                          type="email" 
                          className="form-input"
                          value={reqRecipient}
                          onChange={e => setReqRecipient(e.target.value)}
                          placeholder="klant@gmail.com" 
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bedrag (EUR)</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>€</span>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ paddingLeft: '32px' }}
                            value={reqAmount}
                            onChange={e => setReqAmount(e.target.value)}
                            placeholder="0.00" 
                            min="0.01"
                            step="0.01"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Omschrijving</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={reqDesc}
                          onChange={e => setReqDesc(e.target.value)}
                          placeholder="Bijv. Pizza avond, lunch" 
                          required
                        />
                      </div>
                      <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={invoiceLoading}>
                        {invoiceLoading ? 'Verzenden...' : 'Verzoek Versturen'} <Send size={16} />
                      </button>
                    </form>
                  </div>

                  {/* Payment Requests Lists */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    
                    {/* Ontvangen Verzoeken */}
                    <div className="glass-card">
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowDownLeft size={18} style={{ color: 'var(--color-success)' }} /> Ontvangen Verzoeken
                      </h3>
                      
                      {paymentRequests.filter(r => r.recipientEmail === (user ? user.email : 'tom@finvault.com')).length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
                          Geen openstaande ontvangen betalingsverzoeken.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {paymentRequests.filter(r => r.recipientEmail === (user ? user.email : 'tom@finvault.com')).map(r => {
                            const isPending = r.status === 'pending';
                            return (
                              <div key={r.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.01)',
                                border: '1px solid var(--border-color)',
                                padding: '16px 20px',
                                borderRadius: '12px',
                                fontSize: '0.9rem'
                              }}>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{r.description}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                                    Van: <span style={{ color: 'var(--text-secondary)' }}>{r.creatorEmail}</span> • Aangemaakt: {new Date(r.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: '#fff' }}>
                                      €{r.amount.toFixed(2)}
                                    </div>
                                    <span style={{
                                      fontSize: '0.65rem',
                                      background: r.status === 'paid' ? 'var(--color-success-glow)' : r.status === 'declined' ? 'var(--color-danger-glow)' : 'var(--color-warning-glow)',
                                      color: r.status === 'paid' ? 'var(--color-success)' : r.status === 'declined' ? 'var(--color-danger)' : 'var(--color-warning)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 700,
                                      display: 'inline-block',
                                      marginTop: '4px'
                                    }}>
                                      {r.status.toUpperCase()}
                                    </span>
                                  </div>

                                  {isPending && (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button 
                                        onClick={() => handlePayPaymentRequest(r.id)}
                                        className="btn-primary animate-pulse"
                                        style={{
                                          padding: '6px 12px',
                                          fontSize: '0.75rem',
                                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                          border: 'none',
                                          boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
                                        }}
                                      >
                                        Betaal
                                      </button>
                                      <button 
                                        onClick={() => handleDeclinePaymentRequest(r.id)}
                                        className="btn-secondary"
                                        style={{
                                          padding: '6px 12px',
                                          fontSize: '0.75rem'
                                        }}
                                      >
                                        Weiger
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Verzonden Verzoeken */}
                    <div className="glass-card">
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ArrowUpRight size={18} style={{ color: 'var(--accent-color)' }} /> Verzonden Verzoeken
                      </h3>
                      
                      {paymentRequests.filter(r => r.creatorEmail === (user ? user.email : 'tom@finvault.com')).length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
                          Je hebt nog geen betalingsverzoeken verzonden.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {paymentRequests.filter(r => r.creatorEmail === (user ? user.email : 'tom@finvault.com')).map(r => {
                            return (
                              <div key={r.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.01)',
                                border: '1px solid var(--border-color)',
                                padding: '16px 20px',
                                borderRadius: '12px',
                                fontSize: '0.9rem'
                              }}>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{r.description}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                                    Aan: <span style={{ color: 'var(--text-secondary)' }}>{r.recipientEmail}</span> • Aangemaakt: {new Date(r.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontWeight: 700, color: '#fff' }}>
                                    €{r.amount.toFixed(2)}
                                  </div>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    background: r.status === 'paid' ? 'var(--color-success-glow)' : r.status === 'declined' ? 'var(--color-danger-glow)' : 'var(--color-warning-glow)',
                                    color: r.status === 'paid' ? 'var(--color-success)' : r.status === 'declined' ? 'var(--color-danger)' : 'var(--color-warning)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    display: 'inline-block',
                                    marginTop: '4px'
                                  }}>
                                    {r.status.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {invoiceSubTab === 'mandates' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', alignItems: 'start' }}>
                  
                  {/* Create Mandate Card */}
                  <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Mandaat Instellen</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '20px' }}>
                      Geef toestemming voor automatische incasso (terugkerende afschrijvingen) naar een leverancier of service.
                    </p>

                    {invoiceError && (
                      <div style={{
                        background: 'var(--color-danger-glow)',
                        border: '1px solid var(--color-danger)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        color: 'var(--color-danger)',
                        fontSize: '0.8rem',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <AlertTriangle size={16} />
                        <span style={{ flex: 1 }}>{invoiceError}</span>
                      </div>
                    )}

                    {invoiceSuccess && (
                      <div style={{
                        background: 'var(--color-success-glow)',
                        border: '1px solid var(--color-success)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        color: 'var(--color-success)',
                        fontSize: '0.8rem',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <CheckCircle size={16} />
                        <span>Mandaat succesvol ingesteld!</span>
                      </div>
                    )}

                    <form onSubmit={handleCreateMandate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>E-mail Ontvanger (Crediteur)</label>
                        <input 
                          type="email" 
                          className="form-input"
                          value={mandatePayee}
                          onChange={e => setMandatePayee(e.target.value)}
                          placeholder="hosting@tombomeke-studios.com" 
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bedrag per Termijn (EUR)</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>€</span>
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ paddingLeft: '32px' }}
                            value={mandateAmount}
                            onChange={e => setMandateAmount(e.target.value)}
                            placeholder="0.00" 
                            min="0.01"
                            step="0.01"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Omschrijving</label>
                        <input 
                          type="text" 
                          className="form-input"
                          value={mandateDesc}
                          onChange={e => setMandateDesc(e.target.value)}
                          placeholder="Bijv. Maandelijks Server Hosting Abonnement" 
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Interval (Dagen)</label>
                        <select 
                          className="form-input"
                          value={mandateInterval}
                          onChange={e => setMandateInterval(e.target.value)}
                          style={{ color: '#fff', background: '#1e293b' }}
                        >
                          <option value="7">Wekelijks (7 dagen)</option>
                          <option value="30">Maandelijks (30 dagen)</option>
                          <option value="365">Jaarlijks (365 dagen)</option>
                        </select>
                      </div>
                      <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={invoiceLoading}>
                        {invoiceLoading ? 'Verwerken...' : 'Mandaat Activeren'} <Plus size={16} />
                      </button>
                    </form>
                  </div>

                  {/* Mandates Lists */}
                  <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={18} style={{ color: 'var(--accent-color)' }} /> Actieve Automatische Incasso's
                    </h3>
                    
                    {mandates.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
                        Geen actieve mandaten gevonden.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {mandates.map(m => {
                          const isActive = m.status === 'active';
                          const isPayer = m.payerUserId === (user ? user.id : 'mock-user-123') || m.payerEmail === (user ? user.email : 'tom@finvault.com');
                          return (
                            <div key={m.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: 'rgba(255, 255, 255, 0.01)',
                              border: '1px solid var(--border-color)',
                              padding: '16px 20px',
                              borderRadius: '12px',
                              fontSize: '0.9rem'
                            }}>
                              <div>
                                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{m.description}</span>
                                  <span style={{
                                    fontSize: '0.65rem',
                                    background: isActive ? 'var(--color-success-glow)' : 'rgba(255,255,255,0.05)',
                                    color: isActive ? 'var(--color-success)' : 'var(--text-muted)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 700
                                  }}>
                                    {m.status.toUpperCase()}
                                  </span>
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
                                  Incassant: <span style={{ color: 'var(--text-secondary)' }}>{m.payeeEmail}</span> • Betaler: <span style={{ color: 'var(--text-secondary)' }}>{m.payerEmail}</span>
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '4px' }}>
                                  Volgende afschrijving: <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{new Date(m.nextChargeAt).toLocaleDateString()}</span> • Totaal geïncasseerd: €{m.totalCharged.toFixed(2)} ({m.chargeCount}x)
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
                                  €{m.amount.toFixed(2)}
                                </div>
                                {isActive && isPayer && (
                                  <button 
                                    onClick={() => handleCancelMandate(m.id)}
                                    className="btn-secondary"
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '0.75rem',
                                      color: 'var(--color-danger)',
                                      border: '1px solid var(--color-danger-glow)',
                                      background: 'var(--color-danger-glow)'
                                    }}
                                  >
                                    Intrekken
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
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
