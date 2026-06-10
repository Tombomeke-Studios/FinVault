import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { FVLogo } from '../components/Shell';

interface LandingProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold, rootMargin: '0px 0px -32px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

const FEATURES = [
  {
    icon: 'send',
    title: 'Instant transfers',
    body: 'Send money to anyone, anywhere in seconds. Real-time P2P, SEPA and multi-currency — no hidden fees, ever.',
    color: '#34d399',
  },
  {
    icon: 'card',
    title: 'Smart cards',
    body: 'Physical and virtual cards with instant freeze/unfreeze, custom spend limits, and real-time notifications.',
    color: '#a78bfa',
  },
  {
    icon: 'chart',
    title: 'Spending insights',
    body: 'Automatic categorisation, monthly budgets and trends. Know exactly where every euro goes.',
    color: '#38bdf8',
  },
  {
    icon: 'targetRing',
    title: 'Savings goals',
    body: 'Create saving vaults with targets and deadlines. Auto-stash funds and watch your progress in real time.',
    color: '#fb923c',
  },
  {
    icon: 'shield',
    title: 'Bank-grade security',
    body: 'ISO 27001 certified. PSD2 licensed. End-to-end encrypted. Your vault is protected at every layer.',
    color: '#f472b6',
  },
  {
    icon: 'globe',
    title: '180+ currencies',
    body: 'Hold, exchange and spend in 180+ currencies at the real interbank rate. Travel without surprises.',
    color: '#facc15',
  },
];

const STATS = [
  { value: '€2.4B', label: 'moved monthly' },
  { value: '180+',  label: 'countries' },
  { value: '4.9★',  label: 'app rating' },
  { value: '< 1 s', label: 'transfer time' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Open your vault', body: 'Fill in a few details and your IBAN is ready in under 2 minutes. No paperwork, no branch visit.' },
  { step: '02', title: 'Add funds', body: 'Top up via bank transfer, card or cash. Funds land instantly and are ready to send or invest.' },
  { step: '03', title: 'Move money freely', body: 'Send, receive, exchange and save — all from one screen. Set goals and track every penny in real time.' },
];

export function ScreenLanding({ onGetStarted, onLogin }: LandingProps) {
  const featReveal  = useReveal(0.06);
  const statsReveal = useReveal(0.08);
  const howReveal   = useReveal(0.08);
  const ctaReveal   = useReveal(0.08);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ minHeight: '100dvh', overflowX: 'hidden', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>

      {/* ── Sticky nav ──────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center',
        padding: '0 clamp(20px, 5vw, 80px)',
        height: 64,
        background: 'color-mix(in oklab, var(--bg) 84%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--line)',
        animation: 'fvRise .4s cubic-bezier(.22,.9,.3,1) both',
      }}>
        <FVLogo size={28} />
        <div style={{ flex: 1 }} />
        <nav style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-quiet" onClick={onLogin} style={{ fontSize: '0.9rem', padding: '9px 18px' }}>
            Sign in
          </button>
          <button className="btn btn-primary" onClick={onGetStarted} style={{ fontSize: '0.9rem', padding: '10px 20px' }}>
            Open account
          </button>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: 'calc(100dvh - 64px)',
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(32px, 5vw, 80px)',
        padding: '64px clamp(20px, 5vw, 80px)',
        flexWrap: 'wrap',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glows */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 55% 65% at 85% 15%, var(--accent-soft) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 8% 85%, oklch(0.56 0.15 265 / 0.07) 0%, transparent 65%)',
        }} />

        {/* Copy ─────────────────────────────── */}
        <div style={{ flex: '1 1 440px', minWidth: 280, zIndex: 1 }}>
          <div className="chip chip-accent rise" style={{ display: 'inline-flex', marginBottom: 24, gap: 6 }}>
            <Icon name="sparkle" size={12} />
            PSD2 licensed · ISO 27001 certified
          </div>
          <h1 className="display rise rise-d1" style={{
            fontSize: 'clamp(2.2rem, 4.5vw, 3.9rem)',
            fontWeight: 800, lineHeight: 1.04,
            letterSpacing: '-0.04em', marginBottom: 22,
          }}>
            Banking that moves<br />at the{' '}
            <span style={{ color: 'var(--accent)' }}>speed of you.</span>
          </h1>
          <p className="rise rise-d2" style={{
            fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
            color: 'var(--text-2)', lineHeight: 1.75,
            maxWidth: 460, marginBottom: 36,
          }}>
            Multi-currency wallets, instant transfers, real-time analytics and savings goals — all wrapped in a vault. Free forever. No bank needed.
          </p>
          <div className="rise rise-d3" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <button className="btn btn-primary" onClick={onGetStarted} style={{ fontSize: '1rem', padding: '14px 28px', gap: 10 }}>
              Open free account <Icon name="arrowRight" size={18} />
            </button>
            <button className="btn btn-ghost" onClick={onLogin} style={{ fontSize: '1rem', padding: '14px 24px' }}>
              Sign in
            </button>
          </div>
          <div className="rise rise-d4" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {['No monthly fee', 'Instant IBAN', 'Real exchange rate'].map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.83rem', color: 'var(--text-2)' }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--accent-soft)', border: '1px solid var(--accent-line)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name="check" size={11} style={{ color: 'var(--accent)' }} />
                </span>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Mock UI card ─────────────────────── */}
        <div className="rise rise-d2" style={{ flex: '0 1 340px', minWidth: 260, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Balance card */}
          <div className="float" style={{
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 22,
            padding: '22px 24px 18px',
            boxShadow: 'var(--shadow)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div aria-hidden style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'var(--accent-soft)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Total balance</div>
              <div className="num display" style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em' }}>€12,382.55</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 999, padding: '3px 10px', marginTop: 10, fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent)' }}>
                <Icon name="arrowUpRight" size={11} /> +2.4% this month
              </div>
            </div>
            {/* Sparkline */}
            <div style={{ height: 48, marginTop: 14, opacity: 0.9 }}>
              <svg width="100%" height="48" viewBox="0 0 280 48" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="fv-lg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity=".18" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,40 C30,36 55,28 80,22 C105,16 125,24 150,18 C175,12 200,8 220,11 C240,14 260,7 280,3 L280,48 L0,48 Z" fill="url(#fv-lg)" />
                <path d="M0,40 C30,36 55,28 80,22 C105,16 125,24 150,18 C175,12 200,8 220,11 C240,14 260,7 280,3" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Mini account rows */}
          {[
            { name: 'Everyday Checking', currency: 'EUR', bal: '€4,182', icon: 'card',       color: '#34d399' },
            { name: 'Savings Vault',     currency: 'EUR', bal: '€8,200', icon: 'targetRing', color: '#a78bfa' },
          ].map(w => (
            <div key={w.name} style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 14, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in oklab, ${w.color} 14%, transparent)`, border: `1px solid color-mix(in oklab, ${w.color} 28%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={w.icon} size={16} style={{ color: w.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.2 }}>{w.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 2 }}>{w.currency}</div>
              </div>
              <div className="num" style={{ fontWeight: 700, fontSize: '0.92rem', color: w.color }}>{w.bal}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div ref={statsReveal.ref} style={{
        borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
        background: 'var(--surface)',
        padding: '28px clamp(20px, 5vw, 80px)',
        display: 'flex', gap: 'clamp(20px, 5vw, 64px)', flexWrap: 'wrap',
      }}>
        {STATS.map((s, i) => (
          <div key={s.label} className={statsReveal.visible ? `rise rise-d${i + 1}` : ''} style={{ flex: '1 1 100px', minWidth: 90 }}>
            <div className="num display" style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '-0.03em' }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Feature grid ────────────────────────────────────────────── */}
      <section ref={featReveal.ref} style={{ padding: '88px clamp(20px, 5vw, 80px)' }}>
        <div className={featReveal.visible ? 'rise' : ''} style={{ marginBottom: 56, maxWidth: 540 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Everything in one vault</p>
          <h2 className="display" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08 }}>
            Not just a bank account.<br />A financial command centre.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 18 }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`card card-lift${featReveal.visible ? ` rise rise-d${Math.min(i + 1, 6)}` : ''}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: '24px',
                cursor: 'default',
                borderColor: hovered === i ? `color-mix(in oklab, ${f.color} 40%, transparent)` : 'var(--line)',
                transition: 'border-color .2s ease, transform .22s cubic-bezier(.22,.9,.3,1), box-shadow .22s ease',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `color-mix(in oklab, ${f.color} 14%, transparent)`, border: `1px solid color-mix(in oklab, ${f.color} 26%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon name={f.icon} size={20} style={{ color: f.color }} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8, letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', lineHeight: 1.68 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section ref={howReveal.ref} style={{
        padding: '80px clamp(20px, 5vw, 80px)',
        borderTop: '1px solid var(--line)',
        background: 'var(--surface)',
      }}>
        <div className={howReveal.visible ? 'rise' : ''} style={{ marginBottom: 52 }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Get started in minutes</p>
          <h2 className="display" style={{ fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)', fontWeight: 800, letterSpacing: '-0.03em', maxWidth: 460 }}>
            Up and running before your next coffee.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
          {HOW_IT_WORKS.map((h, i) => (
            <div key={h.step} className={howReveal.visible ? `rise rise-d${i + 1}` : ''} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="num" style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.01em' }}>{h.step}</span>
              </div>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>{h.title}</h3>
                <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', lineHeight: 1.68 }}>{h.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section ref={ctaReveal.ref} style={{
        padding: '96px clamp(20px, 5vw, 80px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
        borderTop: '1px solid var(--line)',
        background: 'linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: '60vw', height: '50vh', background: 'radial-gradient(ellipse, var(--accent-soft) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div className={ctaReveal.visible ? 'rise' : ''} style={{ position: 'relative', marginBottom: 18 }}>
          <span className="chip chip-accent" style={{ gap: 6 }}>
            <Icon name="sparkle" size={12} /> Free forever · No credit card required
          </span>
        </div>
        <h2 className={`display${ctaReveal.visible ? ' rise rise-d1' : ''}`} style={{ position: 'relative', fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 18, lineHeight: 1.06 }}>
          Ready to open your vault?
        </h2>
        <p className={ctaReveal.visible ? 'rise rise-d2' : ''} style={{ position: 'relative', color: 'var(--text-2)', fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)', marginBottom: 40, maxWidth: 400, lineHeight: 1.72 }}>
          Join thousands of users who track, save and move their money smarter every day.
        </p>
        <div className={ctaReveal.visible ? 'rise rise-d3' : ''} style={{ position: 'relative', display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
          <button className="btn btn-primary" onClick={onGetStarted} style={{ fontSize: '1.05rem', padding: '16px 36px', gap: 10 }}>
            Open free account <Icon name="arrowRight" size={18} />
          </button>
          <button className="btn btn-ghost" onClick={onLogin} style={{ fontSize: '1.05rem', padding: '16px 24px' }}>
            Already have an account?
          </button>
        </div>
        <div className={ctaReveal.visible ? 'rise rise-d4' : ''} style={{ position: 'relative', display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Insured deposits', 'ISO 27001', 'PSD2 licensed', 'GDPR compliant'].map(b => (
            <span key={b} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-3)' }}>
              <Icon name="shield" size={12} style={{ color: 'var(--text-3)' }} /> {b}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
