'use client';
import { useState } from 'react';
import { fmtDate } from '@/lib/pht';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

interface Entry {
  id: string;
  bank_name: string;
  bank_code: string;
  amount: number;
  deposited_date: string;
  logged_by: string;
  notes: string | null;
  running_total: number;
}

interface BankSummary {
  bank_id: number;
  bank_name: string;
  bank_code: string;
  total: number;
  entries: Entry[];
}

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


export default function PassbookShell({ data }: { data: BankSummary[] }) {
  const [selected, setSelected] = useState<number | null>(
    data.find(b => b.entries.length > 0)?.bank_id ?? data[0]?.bank_id ?? null
  );

  const bank    = data.find(b => b.bank_id === selected) ?? null;
  const grandTotal = data.reduce((s, b) => s + b.total, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>Passbook</div>
          </div>
        </div>
        <a href="/admin" style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}>← Admin</a>
      </nav>

      <div style={{ padding: '28px 32px', maxWidth: 960 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>ADMIN · PASSBOOK</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ ...Y, fontSize: 24, fontWeight: 800 }}>Bank Passbook</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em' }}>TOTAL ALL BANKS</div>
            <div style={{ ...Y, fontSize: 20, fontWeight: 800, color: '#00d4aa' }}>{php(grandTotal)}</div>
          </div>
        </div>

        {/* Bank selector tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {data.map(b => (
            <button
              key={b.bank_id}
              onClick={() => setSelected(b.bank_id)}
              style={{
                ...M, fontSize: 10, padding: '8px 18px', borderRadius: 8, cursor: 'pointer', letterSpacing: '0.08em',
                border: `1px solid ${selected === b.bank_id ? '#00d4aa' : 'var(--border)'}`,
                background: selected === b.bank_id ? 'rgba(0,212,170,0.1)' : 'transparent',
                color: selected === b.bank_id ? '#00d4aa' : 'var(--muted)',
              }}
            >
              {b.bank_code}
              <span style={{ marginLeft: 8, color: selected === b.bank_id ? '#00d4aa' : 'var(--muted)', fontWeight: selected === b.bank_id ? 700 : 400 }}>
                {php(b.total)}
              </span>
            </button>
          ))}
        </div>

        {/* Selected bank ledger */}
        {bank && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ ...Y, fontSize: 17, fontWeight: 800 }}>{bank.bank_name}</div>
                <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{bank.entries.length} deposit{bank.entries.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em' }}>BALANCE</div>
                <div style={{ ...Y, fontSize: 18, fontWeight: 800, color: '#00d4aa' }}>{php(bank.total)}</div>
              </div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 1fr', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                {['DATE', 'AMOUNT', 'RUNNING TOTAL', 'LOGGED BY', 'NOTES'].map(h => (
                  <div key={h} style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em' }}>{h}</div>
                ))}
              </div>

              {bank.entries.length === 0 && (
                <div style={{ ...M, fontSize: 12, color: 'var(--muted)', padding: '24px 20px' }}>No deposits yet.</div>
              )}

              {/* Entries — newest at top (reverse display order) */}
              {[...bank.entries].reverse().map((e, i) => (
                <div
                  key={e.id}
                  style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 1fr', gap: 12, padding: '12px 20px', borderBottom: i < bank.entries.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}
                >
                  <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{fmtDate(e.deposited_date)}</div>
                  <div style={{ ...M, fontSize: 12, color: '#e2e6f0', fontWeight: 700 }}>{php(e.amount)}</div>
                  <div style={{ ...M, fontSize: 12, color: '#00d4aa' }}>{php(e.running_total)}</div>
                  <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{e.logged_by}</div>
                  <div style={{ ...M, fontSize: 11, color: 'var(--muted)', fontStyle: e.notes ? 'normal' : 'italic' }}>{e.notes ?? '—'}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {data.length === 0 && (
          <div style={{ ...M, fontSize: 12, color: 'var(--muted)', padding: '48px 0', textAlign: 'center' }}>
            No banks set up yet. Add banks in <a href="/admin/banks" style={{ color: '#00d4aa' }}>Manage Banks</a>.
          </div>
        )}
      </div>
    </div>
  );
}
