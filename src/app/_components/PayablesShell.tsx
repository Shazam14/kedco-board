'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';

const M: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const Y: React.CSSProperties = { fontFamily: 'var(--font-sans)' };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface PaymentSlice {
  id: string;
  method: string;
  amount_php: number;
  status: 'PENDING' | 'RECEIVED';
  reference_no: string | null;
}

interface Txn {
  id: string;
  time: string;
  type: 'BUY' | 'SELL';
  source: string;
  currency: string;
  foreign_amt: number;
  rate: number;
  php_amt: number;
  cashier: string;
  customer: string;
  payment_status: 'PENDING' | 'RECEIVED';
  payments: PaymentSlice[];
}

interface PendingRow {
  txn: Txn;
  slice: PaymentSlice;
}

export default function PayablesShell({
  transactions, selectedDate, username,
}: {
  transactions: Txn[];
  selectedDate: string;
  username: string;
}) {
  const router = useRouter();
  useIdleTimeout(20);

  const [txns, setTxns] = useState<Txn[]>(transactions);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleConfirm(txnId: string) {
    setConfirming(txnId);
    const res = await fetch('/api/admin/rider/dispatch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_payment', txn_id: txnId }),
    });
    if (res.ok) {
      setTxns(prev => prev.map(t => t.id === txnId
        ? { ...t, payment_status: 'RECEIVED', payments: t.payments.map(p => ({ ...p, status: 'RECEIVED' as const })) }
        : t));
    }
    setConfirming(null);
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    router.push(v ? `/supervisor/payables?date=${v}` : '/supervisor/payables');
  }

  const rows: PendingRow[] = txns.flatMap(t =>
    t.payments.filter(p => p.status === 'PENDING').map(slice => ({ txn: t, slice }))
  );

  const totalPending = rows.reduce((s, r) => s + r.slice.amount_php, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-base)' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: '60px', borderBottom: '1px solid var(--border-subtle)',
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
              Treasurer · Pending Payments
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-strong)' }}>{username}</span>
          </div>
          <a href="/supervisor" style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, letterSpacing: '0.05em', textDecoration: 'none',
          }}>
            ← HUB
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

      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>
              PENDING PAYMENTS — confirm when funds clear
            </div>
            <div style={{ ...Y, fontSize: 22, fontWeight: 700, color: 'var(--text-strong)' }}>
              {rows.length} pending · {php(totalPending)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>DATE</label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              style={{
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 10px',
                color: 'var(--text-strong)', ...M, fontSize: 12, outline: 'none',
              }}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{
            ...M, fontSize: 12, color: 'var(--text-muted)',
            textAlign: 'center', padding: '60px 0',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
          }}>
            No pending payments for this date.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(({ txn, slice }) => {
              const isConfirming = confirming === txn.id;
              return (
                <div key={slice.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: '70px 60px 1fr 1fr 1fr auto',
                  alignItems: 'center', gap: 14,
                }}>
                  <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>{txn.time}</div>
                  <div style={{
                    ...M, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    padding: '3px 8px', borderRadius: 4, textAlign: 'center',
                    background: txn.type === 'SELL' ? 'rgba(212,90,90,0.12)' : 'rgba(67,189,150,0.12)',
                    color: txn.type === 'SELL' ? 'var(--accent-coral)' : 'var(--teal-300)',
                  }}>{txn.type}</div>
                  <div>
                    <div style={{ ...Y, fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
                      {txn.foreign_amt.toLocaleString('en-PH')} {txn.currency} @ {txn.rate}
                    </div>
                    <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                      {txn.id} · {txn.cashier}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...M, fontSize: 12, color: 'var(--text-strong)' }}>
                      {txn.customer || '—'}
                    </div>
                    {slice.reference_no && (
                      <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                        ref {slice.reference_no}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ ...M, fontSize: 13, color: 'var(--accent-gold)', fontWeight: 700 }}>
                      {slice.method} {php(slice.amount_php)}
                    </div>
                    <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                      ⏳ pending
                    </div>
                  </div>
                  <button
                    onClick={() => handleConfirm(txn.id)}
                    disabled={isConfirming}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none',
                      background: 'var(--teal-600)', color: '#fff',
                      ...M, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      whiteSpace: 'nowrap', opacity: isConfirming ? 0.6 : 1,
                    }}
                  >
                    {isConfirming ? '…' : '✓ CONFIRM'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginTop: 16, lineHeight: 1.6 }}>
            Confirming a transaction with multiple pending slices clears all of them. Per-slice confirmation is on the roadmap.
          </div>
        )}
      </div>
    </div>
  );
}
