'use client';

import { useEffect, useState } from 'react';
import { formatAmountInput, parseAmountInput } from '@/lib/amountInput';

const REASONS = [
  { value: 'MANUAL_DEPOSIT',    label: 'Deposit (cash into safe)' },
  { value: 'MANUAL_WITHDRAWAL', label: 'Withdrawal (cash out, untracked)' },
  { value: 'DEPOSIT_FROM_SHIFT', label: 'Deposit from cashier shift' },
  { value: 'OTHER',             label: 'Other' },
];

type Movement = {
  id: string;
  amount_php: number;
  reason: string;
  note?: string | null;
  actor_username: string;
  created_at: string;
};

type Safe = {
  date: string;
  today_net: number;
  running_net: number;
  movements: Movement[];
};

const php = (n: number) =>
  '₱' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n: number) =>
  (n > 0 ? '+' : n < 0 ? '−' : '') + php(n);

export default function SafeCard() {
  const [data, setData] = useState<Safe | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('MANUAL_DEPOSIT');
  const [note, setNote] = useState('');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/safe', { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    const raw = parseAmountInput(amount);
    if (isNaN(raw) || raw <= 0) { setError('Enter a positive amount.'); return; }
    setSubmitting(true); setError(null);
    try {
      const signed = direction === 'IN' ? Math.abs(raw) : -Math.abs(raw);
      const res = await fetch('/api/admin/safe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount_php: signed, reason, note: note || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail ?? 'Failed to record.');
      } else {
        setShowModal(false); setAmount(''); setNote(''); setReason('MANUAL_DEPOSIT'); setDirection('IN');
        load();
      }
    } finally { setSubmitting(false); }
  }

  const netColor = (n: number) =>
    n > 0 ? 'var(--teal-300)' : n < 0 ? 'var(--accent-coral)' : 'var(--text-muted)';

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid #5b8cff33', borderRadius: 14,
      padding: 24, marginBottom: 20, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg,#5b8cff,transparent)' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10,
            color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>SAFE / VAULT</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800 }}>
            PHP Vault
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          data-testid="safe-add-movement"
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #5b8cff66',
            background: 'rgba(91,140,255,0.12)', color: '#5b8cff',
            fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700,
            letterSpacing: '0.08em', cursor: 'pointer',
          }}
        >+ MOVEMENT</button>
      </div>

      {loading && <div style={{ color: 'var(--muted)', fontSize: 12 }}>Loading…</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9,
                color: 'var(--muted)', letterSpacing: '0.15em', marginBottom: 4 }}>TODAY ({data.date})</div>
              <div data-testid="safe-today-net" style={{ fontFamily: "'DM Mono',monospace", fontSize: 18,
                fontWeight: 700, color: netColor(data.today_net) }}>
                {signed(data.today_net)}
              </div>
            </div>
            <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9,
                color: 'var(--muted)', letterSpacing: '0.15em', marginBottom: 4 }}>RUNNING NET</div>
              <div data-testid="safe-running-net" style={{ fontFamily: "'DM Mono',monospace", fontSize: 18,
                fontWeight: 700, color: netColor(data.running_net) }}>
                {signed(data.running_net)}
              </div>
            </div>
          </div>

          {data.movements.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 11,
              fontFamily: "'DM Mono',monospace", padding: '6px 0' }}>
              No movements today.
            </div>
          ) : (
            <div data-testid="safe-movements-list">
              {data.movements.map(m => (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                  fontFamily: "'DM Mono',monospace", fontSize: 11,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: 'var(--text-strong)' }}>
                      {m.reason} {m.note && <span style={{ color: 'var(--muted)' }}>· {m.note}</span>}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>{m.actor_username}</span>
                  </div>
                  <span style={{ color: netColor(m.amount_php), fontWeight: 700 }}>
                    {signed(m.amount_php)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 24, width: '90%', maxWidth: 420,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800 }}>
                Record Safe Movement
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)',
                  fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(['IN', 'OUT'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  data-testid={`safe-direction-${d}`}
                  style={{
                    flex: 1, padding: 10, borderRadius: 8,
                    border: direction === d ? '1px solid var(--teal-300)' : '1px solid var(--border)',
                    background: direction === d ? 'rgba(61,199,173,0.12)' : 'transparent',
                    color: direction === d ? 'var(--teal-300)' : 'var(--muted)',
                    fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.08em', cursor: 'pointer',
                  }}
                >{d === 'IN' ? '+ DEPOSIT' : '− WITHDRAWAL'}</button>
              ))}
            </div>

            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10,
              color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
              AMOUNT (PHP)
            </label>
            <input
              type="text" inputMode="decimal" value={amount} onChange={e => setAmount(formatAmountInput(e.target.value))}
              data-testid="safe-amount" placeholder="0.00" autoFocus
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px', color: 'var(--text-strong)',
                fontFamily: "'DM Mono',monospace", fontSize: 18, marginBottom: 12, boxSizing: 'border-box',
              }}
            />

            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10,
              color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
              REASON
            </label>
            <select
              value={reason} onChange={e => setReason(e.target.value)}
              data-testid="safe-reason"
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                fontFamily: "'DM Mono',monospace", fontSize: 12, marginBottom: 12, boxSizing: 'border-box',
              }}
            >
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10,
              color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
              NOTE (optional)
            </label>
            <input
              type="text" value={note} onChange={e => setNote(e.target.value)}
              data-testid="safe-note" placeholder="e.g. evening drop, ATM withdrawal..."
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                fontFamily: "'DM Mono',monospace", fontSize: 12, boxSizing: 'border-box',
              }}
            />

            {error && <div style={{ color: 'var(--accent-coral)', fontSize: 11, marginTop: 12 }}>✗ {error}</div>}

            <button
              onClick={submit} disabled={submitting || !amount}
              data-testid="safe-submit"
              style={{
                width: '100%', marginTop: 16, padding: 14, borderRadius: 10, border: 'none',
                background: submitting || !amount ? 'var(--border)' : 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
                color: submitting || !amount ? 'var(--muted)' : '#000',
                fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800,
                cursor: submitting || !amount ? 'not-allowed' : 'pointer',
              }}
            >{submitting ? 'SAVING…' : 'RECORD MOVEMENT'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
