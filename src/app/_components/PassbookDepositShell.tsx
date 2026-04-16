'use client';
import { useState } from 'react';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: '#e2e6f0',
  fontFamily: "'DM Mono',monospace", fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--muted)',
  marginBottom: 4, display: 'block', letterSpacing: '0.08em',
};

interface Bank    { id: number; name: string; code: string; }
interface Entry   { id: string; bank_name: string; bank_code: string; amount: number; deposited_date: string; notes: string | null; created_at: string; }

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function PassbookDepositShell({
  banks,
  recentDeposits: initial,
  username,
}: {
  banks: Bank[];
  recentDeposits: Entry[];
  username: string;
}) {
  const [recent, setRecent]   = useState<Entry[]>(initial);
  const [bankId, setBankId]   = useState<string>(banks[0] ? String(banks[0].id) : '');
  const [amount, setAmount]   = useState('');
  const [date, setDate]       = useState(today());
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit() {
    if (!bankId || !amount || !date) { setError('Fill in all required fields.'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError('Amount must be positive.'); return; }

    setSaving(true); setError(null); setSuccess(null);
    const res = await fetch('/api/passbook/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank_id: parseInt(bankId), amount: amt, deposited_date: date, notes: notes.trim() || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setRecent(prev => [data, ...prev].slice(0, 30));
      setAmount(''); setNotes('');
      const bank = banks.find(b => b.id === parseInt(bankId));
      setSuccess(`Deposit of ${php(amt)} to ${bank?.name ?? ''} logged.`);
    } else {
      setError(data.detail ?? data.error ?? 'Failed to save.');
    }
    setSaving(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>Bank Deposit</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{username}</span>
          <a href="/counter" style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}>← Counter</a>
        </div>
      </nav>

      <div style={{ padding: '28px 24px', maxWidth: 600 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>CASHIER · BANK DEPOSIT</div>
        <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Log Bank Deposit</div>

        {/* Form */}
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 14, padding: '24px', marginBottom: 28 }}>
          <div style={{ marginBottom: 14 }}>
            <span style={lbl}>BANK *</span>
            <select value={bankId} onChange={e => setBankId(e.target.value)}
              style={{ ...inp, appearance: 'none' }}>
              {banks.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <span style={lbl}>AMOUNT (PHP) *</span>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={inp} />
            </div>
            <div>
              <span style={lbl}>DEPOSIT DATE *</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <span style={lbl}>NOTES (optional)</span>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reference no., remarks, etc." style={inp} />
          </div>

          {error   && <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginBottom: 12 }}>{error}</div>}
          {success && <div style={{ ...M, fontSize: 11, color: '#00d4aa', marginBottom: 12 }}>{success}</div>}

          <button onClick={submit} disabled={saving}
            style={{ ...Y, fontSize: 13, fontWeight: 800, padding: '10px 28px', borderRadius: 8, border: 'none', background: saving ? 'var(--surface2)' : 'linear-gradient(135deg,#00d4aa,#00a884)', color: saving ? 'var(--muted)' : '#000', cursor: saving ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : 'Log Deposit'}
          </button>
        </div>

        {/* Recent deposits */}
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 10 }}>YOUR RECENT DEPOSITS</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {recent.length === 0 && (
            <div style={{ ...M, fontSize: 12, color: 'var(--muted)', padding: '20px' }}>No deposits logged yet.</div>
          )}
          {recent.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
              <div>
                <div style={{ ...M, fontSize: 12, color: '#e2e6f0', fontWeight: 700 }}>{php(e.amount)}</div>
                <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  {e.bank_name} · {fmtDate(e.deposited_date)}
                  {e.notes && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>{e.notes}</span>}
                </div>
              </div>
              <span style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>{e.bank_code}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
