'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrencyMeta, Transaction } from '@/lib/types';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';

const M: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const Y: React.CSSProperties = { fontFamily: 'var(--font-sans)' };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFx = (amt: number, code: string, currencies: { code: string; decimalPlaces: number }[]) => {
  const dp = currencies.find(c => c.code === code)?.decimalPlaces ?? 2;
  return amt.toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};

const fmtMode = (mode: string) =>
  mode === 'BANK_TRANSFER' ? 'BANK' : mode === 'SHOPEEPAY' ? 'SHPAY' : mode;

export default function SupervisorTxnsShell({
  currencies,
  username,
}: {
  currencies: CurrencyMeta[];
  username: string;
  role: string;
}) {
  const router = useRouter();
  useIdleTimeout(20);

  const [txns, setTxns] = useState<Transaction[]>([]);
  const [cashierFilter, setCashierFilter] = useState('ALL');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const fetchTxns = useCallback(async () => {
    const res = await fetch('/api/counter/transactions');
    if (res.ok) setTxns(await res.json());
  }, []);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);

  const cashiers = ['ALL', ...Array.from(new Set(txns.map(t => t.cashier))).sort()];
  const displayed = cashierFilter === 'ALL' ? txns : txns.filter(t => t.cashier === cashierFilter);

  const totalBought = displayed.filter(t => t.type === 'BUY').reduce((s, t) => s + t.phpAmt, 0);
  const totalSold   = displayed.filter(t => t.type === 'SELL').reduce((s, t) => s + t.phpAmt, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '60px', borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--nav-bg)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: 'var(--text-on-teal)', fontFamily: 'var(--font-display)',
          }}>K</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
              Kedco <span style={{ color: 'var(--teal-300)' }}>FX</span>
            </div>
            <div style={{ ...M, fontSize: 9, color: 'var(--text-faint)', marginTop: -1 }}>
              Supervisor · Cashier Transactions
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-strong)' }}>{username}</span>
          </div>
          <a href="/counter" style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid rgba(61,199,173,0.35)', background: 'rgba(61,199,173,0.07)',
            color: 'var(--teal-300)', ...M, fontSize: 10, letterSpacing: '0.05em', textDecoration: 'none',
          }}>
            ← COUNTER
          </a>
          <a href="/admin/riders" style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, letterSpacing: '0.05em', textDecoration: 'none',
          }}>
            RIDERS
          </a>
          <button onClick={handleLogout} style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
          }}>
            LOGOUT
          </button>
        </div>
      </nav>

      {/* Body */}
      <div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20, maxWidth: 560 }}>
          {[
            { label: 'TOTAL BOUGHT', value: php(totalBought), color: 'var(--accent-sky)' },
            { label: 'TOTAL SOLD',   value: php(totalSold),   color: 'var(--accent-gold)' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '14px 18px',
            }}>
              <div style={{ ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{ ...Y, fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table header + filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
            TODAY&apos;S TRANSACTIONS — {displayed.length}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              value={cashierFilter}
              onChange={e => setCashierFilter(e.target.value)}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 10px',
                color: 'var(--text-strong)', ...M, fontSize: 11, outline: 'none', cursor: 'pointer',
              }}
            >
              {cashiers.map(c => (
                <option key={c} value={c}>{c === 'ALL' ? 'All cashiers' : c}</option>
              ))}
            </select>
            <button
              onClick={fetchTxns}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', ...M, fontSize: 11 }}
            >
              ↺ refresh
            </button>
          </div>
        </div>

        {/* Transaction table */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {displayed.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', ...M, fontSize: 11, color: 'var(--text-muted)' }}>
              No transactions yet today.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '90px 52px 110px 52px 60px 68px 100px 88px 116px',
                padding: '8px 20px', borderBottom: '1px solid var(--border)',
                ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', whiteSpace: 'nowrap',
              }}>
                <span>RECEIPT</span>
                <span>TIME</span>
                <span>CASHIER</span>
                <span>TYPE</span>
                <span>MODE</span>
                <span>CCY</span>
                <span>FOREIGN</span>
                <span>RATE</span>
                <span>PHP AMT</span>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                {displayed.map((t, i) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 52px 110px 52px 60px 68px 100px 88px 116px',
                      padding: '10px 20px',
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>{t.id}</span>
                    <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>{t.time}</span>
                    <span style={{ ...M, fontSize: 10, color: 'var(--text-strong)' }}>{t.cashier}</span>
                    <span style={{
                      ...M, fontSize: 11, fontWeight: 700,
                      color: t.type === 'BUY' ? 'var(--accent-sky)' : 'var(--accent-gold)',
                    }}>{t.type}</span>
                    <span style={{ ...M, fontSize: 9, color: 'var(--text-muted)' }}>
                      {fmtMode(t.paymentMode ?? 'CASH')}
                    </span>
                    <span style={{ ...M, fontSize: 13, color: 'var(--text-strong)' }}>{t.currency}</span>
                    <span style={{ ...M, fontSize: 12, color: 'var(--text-strong)' }}>
                      {fmtFx(t.foreignAmt, t.currency, currencies)}
                    </span>
                    <span style={{
                      ...M, fontSize: 11,
                      color: t.type === 'BUY' ? 'var(--accent-sky)' : 'var(--accent-gold)',
                    }}>{t.rate}</span>
                    <span style={{ ...M, fontSize: 11, color: 'var(--text-strong)' }}>{php(t.phpAmt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
