import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Icon } from '../components/Icon';
import { money, Avatar, Segmented, PageHead } from '../components/UI';
import { classifyRecipient, normalizeIban } from '../lib/validate';
import { buildEpcQr } from '../lib/epc';
import type { AppData, Beneficiary } from '../App';

interface TransferProps {
  compact: boolean;
  navigate: (r: string) => void;
  fire: (title: string, body: string, type?: string) => void;
  data: AppData;
  beneficiaries?: Beneficiary[];
  onTransfer: (target: { email?: string; iban?: string }, amount: number, desc: string, walletId: string) => Promise<void>;
  onRequest: (email: string, amount: number, desc: string) => Promise<void>;
}

interface Recipient {
  name: string;
  handle: string;
  initials: string;
  hue: number;
  kind: 'email' | 'iban';
}

const CONTACTS: Recipient[] = [
  { name: 'Lena Mertens',  handle: 'lena@finvault.com', initials: 'LM', hue: 320, kind: 'email' },
  { name: 'Sam Janssens',  handle: 'sam@finvault.com',  initials: 'SJ', hue: 230, kind: 'email' },
  { name: 'Maya Peeters',  handle: 'maya@finvault.com', initials: 'MP', hue: 158, kind: 'email' },
  { name: 'Noah De Smet',  handle: 'noah@finvault.com', initials: 'ND', hue: 28,  kind: 'email' },
  { name: 'Eva Claes',     handle: 'eva@finvault.com',  initials: 'EC', hue: 265, kind: 'email' },
];

export function ScreenTransfer({ compact, navigate, fire, data, beneficiaries, onTransfer, onRequest }: TransferProps) {
  const [tab, setTab] = useState<'send' | 'request'>('send');
  const [step, setStep] = useState(0);
  const [to, setTo] = useState<Recipient | null>(null);
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [fromIdx, setFromIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const [reqEmail, setReqEmail] = useState('');
  const [reqAmt, setReqAmt] = useState('');
  const [reqDesc, setReqDesc] = useState('');

  const wallet = data.wallets[fromIdx] || data.wallets[0];
  const reset = () => { setStep(0); setTo(null); setAmt(''); setNote(''); setQuery(''); setCustomName(''); };

  // Saved beneficiaries replace the demo contacts when available (#25).
  const HUES = [320, 230, 158, 28, 265, 200];
  const saved: Recipient[] = (beneficiaries || []).map((b, i) => ({
    name: b.name,
    handle: b.email || b.iban || '',
    initials: (b.name.split(' ').map(p => p[0]).join('').slice(0, 2) || '??').toUpperCase(),
    hue: HUES[i % HUES.length],
    kind: b.iban ? 'iban' as const : 'email' as const,
  }));
  const contactList = saved.length > 0 ? saved : CONTACTS;

  // Recipient validation (#9/#10): the input accepts an email or IBAN; names
  // match the contact list. Anything else gets an inline error.
  const q = query.trim();
  const matchedContacts = q === '' ? contactList : contactList.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) || c.handle.toLowerCase().includes(q.toLowerCase()));
  const queryKind = classifyRecipient(q);
  const queryInvalid = q !== '' && queryKind === 'invalid' && matchedContacts.length === 0;

  const selectCustom = () => {
    if (queryKind === 'invalid') return;
    const handle = queryKind === 'iban' ? normalizeIban(q) : q.toLowerCase();
    const name = customName.trim() || (queryKind === 'iban' ? 'IBAN recipient' : handle.split('@')[0]);
    setTo({ name, handle, initials: name.slice(0, 2).toUpperCase(), hue: 200, kind: queryKind });
    setStep(1);
  };

  const press = (k: string) => setAmt(a => {
    if (k === 'del') return a.slice(0, -1);
    if (k === '.') return a.includes('.') ? a : (a || '0') + '.';
    if (a.includes('.') && a.split('.')[1].length >= 2) return a;
    return (a + k).replace(/^0(\d)/, '$1');
  });
  const amtNum = parseFloat(amt || '0');

  const confirm = async () => {
    if (!to || !wallet) return;
    setLoading(true);
    try {
      const target = to.kind === 'iban' ? { iban: to.handle } : { email: to.handle };
      await onTransfer(target, amtNum, note || `To ${to.name}`, wallet.id);
      setStep(3);
      fire('Payment sent', `${money(amtNum)} to ${to.name}`, 'success');
    } catch (err: any) {
      // Honest failure (#11): no success step, surface the real reason.
      fire('Transfer failed', err?.message || 'Please try again.', 'warn');
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onRequest(reqEmail, parseFloat(reqAmt), reqDesc);
      fire('Request sent', `They'll get a notification to pay you.`, 'success');
      setReqEmail(''); setReqAmt(''); setReqDesc('');
    } finally {
      setLoading(false);
    }
  };

  if (tab === 'request') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)', maxWidth: 640, margin: '0 auto', width: '100%' }}>
        <PageHead title="Money" subtitle="Send or request — instantly, between FinVault accounts." />
        <Segmented value={tab} full options={[{ value: 'send', label: 'Send' }, { value: 'request', label: 'Request' }]} onChange={v => { setTab(v as 'send' | 'request'); reset(); }} />
        <div className="card" style={{ padding: 'var(--pad-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <form onSubmit={submitRequest} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div><label className="label">Request from</label><input className="field" value={reqEmail} onChange={e => setReqEmail(e.target.value)} placeholder="name@finvault.com" required /></div>
            <div style={{ display: 'flex', gap: 'var(--gap)' }}>
              <div style={{ flex: 1 }}><label className="label">Amount</label><input className="field num" value={reqAmt} onChange={e => setReqAmt(e.target.value)} placeholder="0.00" required /></div>
              <div style={{ flex: 2 }}><label className="label">What for?</label><input className="field" value={reqDesc} onChange={e => setReqDesc(e.target.value)} placeholder="Dinner, rent, tickets…" /></div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}><Icon name="qr" size={17} /> Send request</button>
          </form>
        </div>

        {/* Receive via QR (#55): EPC code others can scan to pay you */}
        {data.wallets[0] && (
          <div className="card" style={{ padding: 'var(--pad-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--gap)' }}>
            <div className="eyebrow">Or let them scan your QR</div>
            <div style={{ background: '#ffffff', padding: 16, borderRadius: 'var(--r-lg)', display: 'inline-flex' }}>
              <QRCodeSVG
                size={200}
                value={buildEpcQr({
                  name: `${data.user.firstName} ${data.user.lastName}`,
                  iban: data.wallets[0].iban,
                  amount: parseFloat(reqAmt) > 0 ? parseFloat(reqAmt) : undefined,
                  description: reqDesc || undefined,
                })}
              />
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', textAlign: 'center' }}>
              SEPA QR for {data.wallets[0].iban}{parseFloat(reqAmt) > 0 ? ` · ${money(parseFloat(reqAmt))}` : ''}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)', maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <PageHead title="Money" subtitle="Send or request — instantly, between FinVault accounts." />
      {step < 3 && <Segmented value={tab} full options={[{ value: 'send', label: 'Send' }, { value: 'request', label: 'Request' }]} onChange={v => { setTab(v as 'send' | 'request'); reset(); }} />}

      {/* stepper */}
      {step < 3 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['Recipient', 'Amount', 'Review'].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: i <= step ? 1 : 0.45 }}>
                <span className="num" style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, background: i < step ? 'var(--accent)' : i === step ? 'var(--accent-soft)' : 'var(--surface-2)', color: i < step ? 'var(--on-accent)' : i === step ? 'var(--accent)' : 'var(--text-3)', border: i === step ? '1px solid var(--accent-line)' : 'none' }}>
                  {i < step ? <Icon name="check" size={13} /> : i + 1}
                </span>
                {!compact && <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s}</span>}
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />}
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="card rise" style={{ padding: 'var(--pad-lg)' }}>
        {/* STEP 0 — recipient */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <input
                className="field"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Name, email or IBAN"
                style={{ paddingLeft: 42, borderColor: queryInvalid ? 'var(--neg)' : undefined }}
                aria-invalid={queryInvalid}
              />
            </div>
            {queryInvalid && (
              <div className="shake" style={{ color: 'var(--neg)', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="x" size={14} /> No contact matches and this is not a valid email or IBAN.
              </div>
            )}
            {queryKind !== 'invalid' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', border: '1px solid var(--accent-line)', borderRadius: 'var(--r)', background: 'var(--accent-soft)' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                  Send to {queryKind === 'iban' ? 'IBAN' : 'email'}: <span className="num">{queryKind === 'iban' ? normalizeIban(q) : q.toLowerCase()}</span>
                </div>
                <input
                  className="field"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Recipient name (used in the description)"
                  style={{ background: 'var(--surface)' }}
                />
                <button className="btn btn-primary" onClick={selectCustom}>Continue <Icon name="arrowRight" size={16} /></button>
              </div>
            )}
            <div className="eyebrow" style={{ marginTop: 4 }}>{saved.length > 0 ? 'Saved payees' : 'Recent'}</div>
            {matchedContacts.length === 0 && q !== '' && (
              <div style={{ color: 'var(--text-3)', fontSize: '0.86rem' }}>No contacts match "{q}".</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 'var(--gap)' }}>
              {matchedContacts.map(c => (
                <button key={c.handle} onClick={() => { setTo(c); setStep(1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 6 }}>
                  <Avatar initials={c.initials} hue={c.hue} size={54} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-2)', textAlign: 'center' }}>{c.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 1 — amount */}
        {step === 1 && to && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={to.initials} hue={to.hue} size={36} />
              <div><div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{to.name}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{to.handle}</div></div>
            </div>
            <div className="num display" style={{ fontSize: 'clamp(2.6rem, 9vw, 3.6rem)', fontWeight: 700, color: amtNum > 0 ? 'var(--text)' : 'var(--text-3)', margin: '8px 0' }}>
              €{amt || '0'}
            </div>
            <div className="num" style={{ fontSize: '0.84rem', color: amtNum > (wallet?.balance || 0) ? 'var(--neg)' : 'var(--text-3)' }}>
              From {wallet?.name || (wallet?.type === 'savings' ? 'Savings' : wallet?.type === 'travel' ? 'Travel' : 'Everyday')} · {money(wallet?.balance || 0, wallet?.currency || 'EUR')} available
            </div>
            {/* wallet selector if multiple */}
            {data.wallets.length > 1 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {data.wallets.map((w, i) => (
                  <button key={w.id} onClick={() => setFromIdx(i)} className={fromIdx === i ? 'chip chip-accent' : 'chip'} style={{ cursor: 'pointer' }}>
                    {w.name || (w.type === 'savings' ? 'Savings' : w.type === 'travel' ? 'Travel' : 'Everyday')}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%', maxWidth: 320, marginTop: 8 }}>
              {['1','2','3','4','5','6','7','8','9','.','0','del'].map(k => (
                <button key={k} onClick={() => press(k)} style={{ aspectRatio: '1.7', border: '1px solid var(--line)', background: 'var(--surface-2)', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-num)' }}>
                  {k === 'del' ? <Icon name="chevLeft" size={20} /> : k}
                </button>
              ))}
            </div>
            <input className="field" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note (optional)" style={{ maxWidth: 320 }} />
            <div style={{ display: 'flex', gap: 'var(--gap)', width: '100%', maxWidth: 320 }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)} style={{ flex: '0 0 auto' }}><Icon name="arrowLeft" size={18} /></button>
              <button className="btn btn-primary btn-block" disabled={!(amtNum > 0 && amtNum <= (wallet?.balance || 0))} onClick={() => setStep(2)} style={{ opacity: amtNum > 0 && amtNum <= (wallet?.balance || 0) ? 1 : 0.5 }}>Continue</button>
            </div>
          </div>
        )}

        {/* STEP 2 — review */}
        {step === 2 && to && wallet && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div className="eyebrow">You're sending</div>
              <div className="num display" style={{ fontSize: '2.8rem', fontWeight: 700, marginTop: 4 }}>{money(amtNum)}</div>
            </div>
            {[['To', to.name], ['Account', to.handle], ['From', `${wallet.name || 'Everyday'} · ${wallet.iban}`], ['Note', note || '—'], ['Fee', 'Free · instant'], ['Arrives', 'Instantly']].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ color: 'var(--text-3)', fontSize: '0.88rem' }}>{k}</span>
                <span className="num" style={{ fontWeight: 600, fontSize: '0.9rem', textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 'var(--gap)', marginTop: 4 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}><Icon name="arrowLeft" size={18} /></button>
              <button className="btn btn-primary btn-block" onClick={confirm} disabled={loading}>
                <Icon name="lock" size={16} /> {loading ? 'Sending…' : 'Confirm & send'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — success */}
        {step === 3 && to && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--gap)', padding: '20px 0', textAlign: 'center' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'color-mix(in oklab, var(--pos) 18%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pos)', animation: 'fvPop .4s cubic-bezier(.22,.9,.3,1)' }}>
              <Icon name="check" size={42} stroke={3} />
            </div>
            <div>
              <div className="display" style={{ fontSize: '1.4rem', fontWeight: 700 }}>Payment sent</div>
              <div style={{ color: 'var(--text-2)', marginTop: 4 }}>{money(amtNum)} to {to.name}</div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--gap)', width: '100%', maxWidth: 320, marginTop: 8 }}>
              <button className="btn btn-ghost btn-block" onClick={reset}>Send another</button>
              <button className="btn btn-primary btn-block" onClick={() => navigate('overview')}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
