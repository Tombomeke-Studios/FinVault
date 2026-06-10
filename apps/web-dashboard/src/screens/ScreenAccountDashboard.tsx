import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { money, relTime, CategoryIcon, Sparkline } from '../components/UI';
import { Sheet } from '../components/UI';
import type { AppData } from '../App';

interface AccountDashboardProps {
  walletId: string;
  compact: boolean;
  navigate: (r: string) => void;
  data: AppData;
  onOwnTransfer: (fromWalletId: string, toWalletId: string, amount: number, description: string) => Promise<void>;
  fire: (title: string, body: string, type?: string) => void;
}

function walletAccentVars(type: string): { color: string; soft: string; line: string } {
  if (type === 'savings') return { color: 'oklch(0.68 0.17 300)', soft: 'oklch(0.68 0.17 300 / 0.13)', line: 'oklch(0.68 0.17 300 / 0.30)' };
  if (type === 'travel')  return { color: 'oklch(0.70 0.14 220)', soft: 'oklch(0.70 0.14 220 / 0.13)', line: 'oklch(0.70 0.14 220 / 0.30)' };
  return { color: 'var(--accent)', soft: 'var(--accent-soft)', line: 'var(--accent-line)' };
}

function walletIconName(type: string): string {
  if (type === 'savings') return 'targetRing';
  if (type === 'travel')  return 'globe';
  return 'wallet';
}

export function ScreenAccountDashboard({ walletId, compact, navigate, data, onOwnTransfer, fire }: AccountDashboardProps) {
  const { wallets, transactions } = data;
  const wallet = wallets.find(w => w.id === walletId);

  const [transferOpen, setTransferOpen] = useState(false);
  const [fromWalletId, setFromWalletId] = useState('');
  const [transferAmt, setTransferAmt] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [showBars, setShowBars] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShowBars(true), 120); return () => clearTimeout(t); }, []);

  if (!wallet) {
    return (
      <div style={{ padding: 'var(--pad-lg)', textAlign: 'center', color: 'var(--text-3)' }}>
        <Icon name="wallet" size={36} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
        Account not found.
      </div>
    );
  }

  const ac = walletAccentVars(wallet.type);
  const otherWallets = wallets.filter(w => w.id !== walletId);
  const fromWallet = otherWallets.find(w => w.id === fromWalletId) || otherWallets[0];

  // Wallet-filtered transactions
  const walletTxs = transactions.filter(t => t.senderWalletId === walletId || t.receiverWalletId === walletId);
  const moneyIn  = walletTxs.filter(t => t.receiverWalletId === walletId).reduce((s, t) => s + t.amount, 0);
  const moneyOut = walletTxs.filter(t => t.senderWalletId   === walletId).reduce((s, t) => s + t.amount, 0);

  // Simple balance trend for sparkline (reconstruct from filtered txs)
  const trendPoints: number[] = [];
  let running = wallet.balance;
  const sorted = [...walletTxs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  trendPoints.push(Math.round(running));
  sorted.slice(0, 6).forEach(t => {
    if (t.receiverWalletId === walletId) running -= t.amount;
    else running += t.amount;
    trendPoints.unshift(Math.max(0, Math.round(running)));
  });

  const doTransfer = async () => {
    const val = parseFloat(transferAmt);
    if (!val || val <= 0) { fire('Invalid amount', 'Please enter a valid amount.', 'warn'); return; }
    if (!fromWallet)       { fire('No source', 'No other account to transfer from.', 'warn'); return; }
    if (fromWallet.balance < val) {
      fire('Insufficient funds', `${fromWallet.name || fromWallet.type} only has ${money(fromWallet.balance, fromWallet.currency)}.`, 'warn');
      return;
    }
    setTransferring(true);
    try {
      await onOwnTransfer(fromWallet.id, walletId, val, transferDesc || `Transfer to ${wallet.name || wallet.type}`);
      setTransferAmt('');
      setTransferDesc('');
      setTransferOpen(false);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>

      {/* ── Breadcrumb back nav ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => navigate('overview')}
          className="btn btn-quiet"
          style={{ padding: '5px 10px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="chevLeft" size={14} /> Accounts
        </button>
        <span style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>/</span>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-2)', fontWeight: 600 }}>
          {wallet.name || (wallet.type === 'savings' ? 'Savings Vault' : wallet.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking')}
        </span>
      </div>

      {/* ── Hero card ── */}
      <div
        className="card card-hero rise"
        style={{
          padding: 'var(--pad-lg)',
          borderTop: `3px solid ${ac.color}`,
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          gap: 'var(--gap-lg)',
          alignItems: compact ? 'flex-start' : 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow blob */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 220, height: 220,
          borderRadius: '50%', background: ac.soft, pointerEvents: 'none',
        }} />

        {/* Left: identity + balance */}
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: ac.soft, border: `1px solid ${ac.line}`,
            }}>
              <Icon name={walletIconName(wallet.type)} size={22} style={{ color: ac.color }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {wallet.name || (wallet.type === 'savings' ? 'Savings Vault' : wallet.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-num)' }}>
                {wallet.iban} &nbsp;·&nbsp; {wallet.currency}
              </div>
            </div>
            <span className="chip" style={{ marginLeft: 'auto', background: ac.soft, color: ac.color, border: `1px solid ${ac.line}`, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {wallet.type}
            </span>
          </div>

          <div className="eyebrow" style={{ marginBottom: 6 }}>Current balance</div>
          <div className="num display" style={{ fontSize: 'clamp(2.4rem, 6vw, 3.6rem)', fontWeight: 700, letterSpacing: '-0.03em', color: ac.color, lineHeight: 1 }}>
            {money(wallet.balance, wallet.currency)}
          </div>

          {(wallet.interestRate || 0) > 0 && (
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: ac.soft, border: `1px solid ${ac.line}`, borderRadius: 'var(--r-pill)', padding: '3px 10px' }}>
              <Icon name="bolt" size={11} style={{ color: ac.color }} />
              <span style={{ fontSize: '0.73rem', fontWeight: 700, color: ac.color }}>{((wallet.interestRate || 0) * 100).toFixed(1)}% APY</span>
            </div>
          )}
        </div>

        {/* Right: sparkline + stats */}
        <div style={{ minWidth: compact ? '100%' : 280, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 1 }}>
          {trendPoints.length > 1 && (
            <div style={{ marginBottom: 4 }}>
              <Sparkline data={trendPoints} h={60} />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Money In',  value: money(moneyIn, wallet.currency), color: 'var(--pos)' },
              { label: 'Money Out', value: money(moneyOut, wallet.currency), color: 'var(--neg)' },
              { label: 'Activity',  value: String(walletTxs.length), color: 'var(--text)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface-2)', borderRadius: 'var(--r)', padding: '10px 12px', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                <div className="num" style={{ fontSize: '0.92rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => { setFromWalletId(otherWallets[0]?.id || ''); setTransferOpen(true); }}
          className="btn"
          style={{ background: ac.color, color: 'var(--on-accent)', border: 'none', boxShadow: `0 8px 24px -8px ${ac.color}`, gap: 8, display: 'flex', alignItems: 'center', fontWeight: 700, padding: '10px 20px' }}
        >
          <Icon name="arrowDownLeft" size={16} style={{ color: 'var(--on-accent)' }} /> Add Money
        </button>
        <button onClick={() => navigate('transfer')} className="btn btn-quiet" style={{ gap: 8, display: 'flex', alignItems: 'center', padding: '10px 18px' }}>
          <Icon name="send" size={15} /> Send Money
        </button>
        <button onClick={() => navigate('transactions')} className="btn btn-quiet" style={{ gap: 8, display: 'flex', alignItems: 'center', padding: '10px 18px' }}>
          <Icon name="list" size={15} /> All Activity
        </button>
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.7fr 1fr', gap: 'var(--gap-lg)' }}>

        {/* Activity feed */}
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap)', padding: '0 4px' }}>
            <h2 className="display" style={{ fontSize: '1.05rem', fontWeight: 700 }}>Account Activity</h2>
            {walletTxs.length > 8 && (
              <button onClick={() => navigate('transactions')} className="btn btn-quiet" style={{ padding: '4px 8px', fontSize: '0.8rem', color: ac.color }}>
                See all <Icon name="chevRight" size={13} />
              </button>
            )}
          </div>

          {walletTxs.length === 0 && (
            <div style={{ padding: '32px 8px', textAlign: 'center', color: 'var(--text-3)' }}>
              <Icon name="list" size={28} style={{ opacity: 0.35, display: 'block', margin: '0 auto 10px' }} />
              No transactions for this account yet.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {walletTxs.slice(0, 12).map((t, idx) => {
              const isIn = t.receiverWalletId === walletId;
              const displayAmt = isIn ? t.amount : -t.amount;
              const cat = t.type === 'deposit' ? 'deposit' : 'transfer';
              return (
                <div key={t.id} className={`tx-row rise rise-d${Math.min(idx + 1, 6)}`}>
                  <CategoryIcon cat={cat} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description || 'Transaction'}
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: '0.75rem', marginTop: 2 }}>{relTime(new Date(t.createdAt).getTime())}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="num" style={{ fontWeight: 700, fontSize: '0.96rem', color: displayAmt > 0 ? 'var(--pos)' : 'var(--text)' }}>
                      {money(displayAmt, t.currency || 'EUR', { signed: true })}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 1 }}>{isIn ? '↓ received' : '↑ sent'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>

          {/* Quick account stats */}
          <div className="card" style={{ padding: 'var(--pad)' }}>
            <h2 className="display" style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 14 }}>Account details</h2>
            {[
              { label: 'Account type', value: wallet.type.charAt(0).toUpperCase() + wallet.type.slice(1) },
              { label: 'Currency',     value: wallet.currency },
              { label: 'IBAN',         value: wallet.iban || '—' },
              ...(wallet.interestRate && wallet.interestRate > 0 ? [{ label: 'Interest rate', value: `${(wallet.interestRate * 100).toFixed(2)}% APY` }] : []),
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>{row.label}</span>
                <span className="num" style={{ fontSize: '0.86rem', fontWeight: 700 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Other accounts */}
          {otherWallets.length > 0 && (
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <h2 className="display" style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 14 }}>Your other accounts</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {otherWallets.map((w, i) => {
                  const a = walletAccentVars(w.type);
                  return (
                    <button
                      key={w.id}
                      onClick={() => navigate(`account:${w.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px',
                        borderBottom: i < otherWallets.length - 1 ? '1px solid var(--line)' : 'none',
                        background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                      className="btn btn-quiet"
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.soft, border: `1px solid ${a.line}`, flexShrink: 0 }}>
                        <Icon name={walletIconName(w.type)} size={15} style={{ color: a.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {w.name || (w.type === 'savings' ? 'Savings Vault' : w.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking')}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 1 }}>{w.iban || w.currency}</div>
                      </div>
                      <div className="num" style={{ fontSize: '0.9rem', fontWeight: 700, color: a.color, flexShrink: 0 }}>
                        {money(w.balance, w.currency)}
                      </div>
                      <Icon name="chevRight" size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Money transfer sheet ── */}
      <Sheet open={transferOpen} onClose={() => setTransferOpen(false)} title={`Add money to ${wallet.name || wallet.type}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', lineHeight: 1.55, margin: 0 }}>
            Instantly move funds from one of your other accounts — zero fees, zero delays.
          </p>

          {/* Source picker */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>From account</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {otherWallets.map(w => {
                const a = walletAccentVars(w.type);
                const sel = (fromWalletId || otherWallets[0]?.id) === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => setFromWalletId(w.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: sel ? a.soft : 'var(--surface-2)',
                      border: `1.5px solid ${sel ? a.line : 'var(--line)'}`,
                      borderRadius: 'var(--r)', padding: '12px 14px',
                      cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color .15s, background .15s',
                    }}
                    className="btn"
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.soft, flexShrink: 0 }}>
                      <Icon name={walletIconName(w.type)} size={14} style={{ color: a.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: sel ? a.color : 'var(--text)' }}>
                        {w.name || (w.type === 'savings' ? 'Savings Vault' : w.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking')}
                      </div>
                      <div className="num" style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 2 }}>{money(w.balance, w.currency)} available</div>
                    </div>
                    {sel && <Icon name="check" size={14} style={{ color: a.color, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: ac.soft, border: `1px solid ${ac.line}`, borderRadius: 'var(--r)', padding: '12px 14px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: ac.soft }}>
              <Icon name={walletIconName(wallet.type)} size={14} style={{ color: ac.color }} />
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: ac.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>To</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: ac.color }}>
                {wallet.name || (wallet.type === 'savings' ? 'Savings Vault' : wallet.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking')}
              </div>
              <div className="num" style={{ fontSize: '0.76rem', color: 'var(--text-3)', marginTop: 1 }}>Current: {money(wallet.balance, wallet.currency)}</div>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Amount</div>
            <input
              type="number"
              inputMode="decimal"
              value={transferAmt}
              onChange={e => setTransferAmt(e.target.value)}
              placeholder="0.00"
              style={{
                width: '100%', background: 'var(--surface-2)', border: '1.5px solid var(--line)',
                borderRadius: 'var(--r)', padding: '14px 16px', color: 'var(--text)',
                fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--font-num)',
                textAlign: 'center', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s',
              }}
              onFocus={e => { e.target.style.borderColor = ac.color; }}
              onBlur={e => { e.target.style.borderColor = 'var(--line)'; }}
            />
            {/* Quick chips */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {[50, 100, 250, 500].map(v => (
                <button key={v} onClick={() => setTransferAmt(String(v))} className="btn btn-quiet"
                  style={{ flex: 1, padding: '8px 0', fontSize: '0.82rem', fontWeight: 700 }}>
                  +€{v}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Note (optional)</div>
            <input
              type="text"
              value={transferDesc}
              onChange={e => setTransferDesc(e.target.value)}
              placeholder="e.g. Monthly savings transfer"
              style={{
                width: '100%', background: 'var(--surface-2)', border: '1px solid var(--line)',
                borderRadius: 'var(--r)', padding: '11px 14px', color: 'var(--text)',
                fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Submit */}
          <button
            onClick={doTransfer}
            disabled={transferring || !transferAmt}
            style={{
              background: ac.color, color: 'var(--on-accent)', border: 'none',
              borderRadius: 'var(--r)', padding: '14px 24px', fontWeight: 700, fontSize: '0.96rem',
              cursor: transferring || !transferAmt ? 'not-allowed' : 'pointer',
              opacity: transferring || !transferAmt ? 0.55 : 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, transition: 'opacity .15s',
            }}
          >
            <Icon name="arrowDownLeft" size={16} style={{ color: 'var(--on-accent)' }} />
            {transferring ? 'Processing…' : `Transfer ${transferAmt ? money(parseFloat(transferAmt) || 0) : 'Funds'}`}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
