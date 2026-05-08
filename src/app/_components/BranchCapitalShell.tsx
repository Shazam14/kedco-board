'use client';
import { useState } from 'react';
import { formatAmountInput, parseAmountInput } from '@/lib/amountInput';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const BRANCHES = [
  { code: 'MAIN',  name: 'Main' },
  { code: 'CTS',   name: 'CTS' },
  { code: 'BAI',   name: 'Bai' },
  { code: 'SM',    name: 'SM' },
  { code: 'GOLD',  name: 'Gold' },
  { code: 'JMALL', name: 'Jmall' },
  { code: 'ESY2',  name: 'ESY 2' },
  { code: 'DATAG', name: 'Monekat Datag' },
  { code: 'MOBO',  name: 'Monekat Mobo' },
] as const;

interface Row {
  branch_code: string;
  amount_php:  number;
  updated_by:  string | null;
  updated_at:  string | null;
}
interface Initial {
  total_php: number;
  rows:      Row[];
}

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWhen = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function BranchCapitalShell({ initial, embedded = false }: { initial: Initial; embedded?: boolean }) {
  const [data, setData] = useState<Initial>(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.rows.map(r => [r.branch_code, formatAmountInput(String(r.amount_php))]))
  );
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byCode = Object.fromEntries(data.rows.map(r => [r.branch_code, r])) as Record<string, Row>;

  const body = (
    <>
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
        <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.2em', marginBottom: 8 }}>TOTAL ALLOCATED</div>
        <div style={{ ...Y, fontSize: 32, fontWeight: 800, color: '#00d4aa' }}>{php(data.total_php)}</div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 160px 130px 100px', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em' }}>
          <span>BRANCH</span>
          <span>AMOUNT (₱)</span>
          <span>LAST UPDATE</span>
          <span style={{ textAlign: 'right' }}>CURRENT</span>
          <span></span>
        </div>
        {BRANCHES.map((b, i) => {
          const row = byCode[b.code];
          const draft = drafts[b.code] ?? '';
          const dirty = formatAmountInput(String(row?.amount_php ?? 0)) !== draft;
          return (
            <div key={b.code} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 160px 130px 100px', gap: 12, alignItems: 'center', padding: '12px 20px', borderBottom: i < BRANCHES.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
              <div>
                <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>{b.name}</div>
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>{b.code}</div>
              </div>
              <input value={draft} onChange={e => setDrafts(d => ({ ...d, [b.code]: formatAmountInput(e.target.value) }))}
                placeholder="0" inputMode="decimal"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: '#e2e6f0', ...M, fontSize: 12, outline: 'none' }} />
              <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>
                {row ? `${fmtWhen(row.updated_at)} · ${row.updated_by ?? '—'}` : '— never —'}
              </span>
              <span style={{ ...Y, fontSize: 13, fontWeight: 700, color: '#00d4aa', textAlign: 'right' }}>
                {row ? php(row.amount_php) : '—'}
              </span>
              <button onClick={() => save(b.code)} disabled={!dirty || savingCode === b.code}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: !dirty ? 'var(--border)' : 'linear-gradient(135deg,#00d4aa,#00a884)', color: !dirty ? 'var(--muted)' : '#000', ...Y, fontSize: 11, fontWeight: 800, cursor: !dirty ? 'default' : 'pointer' }}>
                {savingCode === b.code ? '…' : 'SAVE'}
              </button>
            </div>
          );
        })}
      </div>

      {error && <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginTop: 12 }}>{error}</div>}
    </>
  );

  async function refresh() {
    const res = await fetch('/api/admin/branch-capital', { cache: 'no-store' });
    if (res.ok) {
      const fresh = await res.json();
      setData(fresh);
      setDrafts(Object.fromEntries(fresh.rows.map((r: Row) => [r.branch_code, formatAmountInput(String(r.amount_php))])));
    }
  }

  async function save(code: string) {
    const num = parseAmountInput(drafts[code] ?? '');
    if (isNaN(num) || num < 0) { setError(`${code}: enter a non-negative number.`); return; }
    setSavingCode(code); setError(null);
    const res = await fetch(`/api/admin/branch-capital/${encodeURIComponent(code)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_php: num }),
    });
    if (res.ok) await refresh();
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail ?? 'Failed to save.');
    }
    setSavingCode(null);
  }

  if (embedded) return body;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>Branch Capital</div>
          </div>
        </div>
        <a href="/admin" style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}>← Admin</a>
      </nav>

      <div style={{ padding: '28px 32px', maxWidth: 880 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>ADMIN · CAPITAL</div>
        <div style={{ ...Y, fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Branches Capital</div>
        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
          Per-branch peso allocation. Set the number you&apos;ve earmarked for each branch — this is subtracted from
          total Capital in the reconciliation formula.
        </div>
        {body}
      </div>
    </div>
  );
}
