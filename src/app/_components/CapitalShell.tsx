'use client';
import { useState } from 'react';
import BranchCapitalShell from './BranchCapitalShell';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

interface Entry {
  id: string;
  amount_php: number;
  note: string | null;
  entry_date: string;
  created_by: string;
  created_at: string;
}

interface Ledger {
  running_total: number;
  entries: Entry[];
}

interface BranchInitial {
  total_php: number;
  rows: { branch_code: string; amount_php: number; updated_by: string | null; updated_at: string | null }[];
}

type Tab = 'php' | 'branches';

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

export default function CapitalShell({ initial, today, branchInitial }: {
  initial: Ledger;
  today?: string;
  branchInitial: BranchInitial;
}) {
  const [tab, setTab]         = useState<Tab>('php');
  const [ledger, setLedger]   = useState<Ledger>(initial);
  const [amount, setAmount]   = useState('');
  const [note, setNote]       = useState('');
  const [date, setDate]       = useState(today ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/admin/capital', { cache: 'no-store' });
    if (res.ok) setLedger(await res.json());
  }

  async function addEntry() {
    const num = parseFloat(amount);
    if (!num || isNaN(num)) { setError('Enter a non-zero amount.'); return; }

    setSaving(true); setError(null);
    const res = await fetch('/api/admin/capital', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_php: num,
        note: note.trim() || null,
        entry_date: date,
      }),
    });
    if (res.ok) {
      setAmount(''); setNote('');
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.detail ?? 'Failed to record entry.');
    }
    setSaving(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>PHP Capital</div>
          </div>
        </div>
        <a href="/admin" style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}>← Admin</a>
      </nav>

      <div style={{ padding: '28px 32px', maxWidth: 880 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>ADMIN · CAPITAL</div>
        <div style={{ ...Y, fontSize: 24, fontWeight: 800, marginBottom: 18 }}>Capital Management</div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: '1px solid var(--border)' }}>
          {([
            { key: 'php',      label: 'PHP CAPITAL'    },
            { key: 'branches', label: 'BRANCH CAPITAL' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                ...M, fontSize: 11, letterSpacing: '0.12em', fontWeight: 700,
                padding: '10px 18px', cursor: 'pointer', background: 'transparent',
                border: 'none', borderBottom: tab === t.key ? '2px solid #00d4aa' : '2px solid transparent',
                color: tab === t.key ? '#00d4aa' : 'var(--muted)', marginBottom: -1,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'branches' && (
          <>
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.6 }}>
              Per-branch peso allocation. Set the number you&apos;ve earmarked for each branch — this is subtracted
              from total Capital in the reconciliation formula.
            </div>
            <BranchCapitalShell initial={branchInitial} embedded />
          </>
        )}

        {tab === 'php' && (<>

        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
          Owner-contributed PHP principal — the capital that funds the business.
          Distinct from safe movements (operational vault flow) and bale.
        </div>

        {/* Running total */}
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.2em', marginBottom: 8 }}>RUNNING TOTAL</div>
          <div style={{ ...Y, fontSize: 32, fontWeight: 800, color: '#00d4aa' }}>{php(ledger.running_total)}</div>
        </div>

        {/* Add new entry */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 28 }}>
          <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 14 }}>RECORD CAPITAL ENTRY</div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 140px 1fr auto', gap: 10, alignItems: 'flex-start' }}>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>AMOUNT (₱)</div>
              <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500000 or -50000" inputMode="decimal"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>DATE</div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>NOTE (OPTIONAL)</div>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Owner injection · withdrawal"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ paddingTop: 17 }}>
              <button onClick={addEntry} disabled={saving || !amount}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: !amount ? 'var(--border)' : 'linear-gradient(135deg,#00d4aa,#00a884)', color: !amount ? 'var(--muted)' : '#000', ...Y, fontSize: 12, fontWeight: 800, cursor: !amount ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                {saving ? '…' : '+ RECORD'}
              </button>
            </div>
          </div>
          <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
            Use a positive amount for capital injection, negative for withdrawal.
          </div>
          {error && <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginTop: 10 }}>{error}</div>}
        </div>

        {/* Ledger */}
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 10 }}>
          ENTRIES ({ledger.entries.length})
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {ledger.entries.length === 0 && (
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)', padding: '16px 20px' }}>No entries yet.</div>
          )}
          {ledger.entries.map((e, i) => {
            const positive = e.amount_php >= 0;
            const sign = positive ? '+' : '−';
            return (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 160px 120px', gap: 12, alignItems: 'center', padding: '12px 20px', borderBottom: i < ledger.entries.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{fmtDate(e.entry_date)}</span>
                <span style={{ ...M, fontSize: 12, color: '#e2e6f0' }}>{e.note ?? '—'}</span>
                <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>by {e.created_by}</span>
                <span style={{ ...Y, fontSize: 14, fontWeight: 800, color: positive ? '#00d4aa' : '#ff5c5c', textAlign: 'right' }}>
                  {sign}{php(Math.abs(e.amount_php))}
                </span>
              </div>
            );
          })}
        </div>
        </>)}
      </div>
    </div>
  );
}
