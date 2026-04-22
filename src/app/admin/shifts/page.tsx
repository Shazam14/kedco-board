'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };
const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Shift = {
  id: string;
  cashier: string;
  cashier_name: string;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at?: string;
  opening_cash_php: number;
  closing_cash_php?: number;
  expected_cash_php?: number;
  cash_variance?: number;
  txn_count: number;
  total_sold_php: number;
  total_bought_php: number;
  total_than: number;
  total_commission: number;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function ShiftsPage() {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/shifts', { cache: 'no-store' })
      .then(r => { if (r.status === 403) router.push('/login'); return r.json(); })
      .then(data => { if (Array.isArray(data)) setShifts(data); })
      .finally(() => setLoading(false));
  }, [router]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0', padding: '32px 24px' }}>

      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <button
          onClick={() => router.push('/admin')}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', ...M, fontSize: 11, cursor: 'pointer', marginBottom: 20, padding: 0 }}
        >
          ← Back
        </button>
        <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.2em', marginBottom: 6 }}>
          TELLER SHIFTS
        </div>
        <div style={{ ...Y, fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
          Shift Log — Today
        </div>
        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 32 }}>
          {today.toUpperCase()}
        </div>

        {loading ? (
          <div style={{ ...M, fontSize: 12, color: 'var(--muted)' }}>Loading...</div>
        ) : shifts.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '40px 24px', textAlign: 'center',
            ...M, fontSize: 12, color: 'var(--muted)',
          }}>
            No shifts opened today yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {shifts.map(s => {
              const isOpen    = s.status === 'OPEN';
              const variance  = s.cash_variance ?? 0;
              const varColor  = variance === 0 ? '#00d4aa' : variance > 0 ? '#00d4aa' : '#ff5c5c';

              return (
                <div key={s.id} style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isOpen ? 'rgba(0,212,170,0.3)' : 'var(--border)'}`,
                  borderRadius: 14, padding: '20px 24px',
                }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ ...Y, fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
                        {s.cashier_name}
                        <span style={{ ...M, fontSize: 10, color: 'var(--muted)', marginLeft: 8 }}>
                          @{s.cashier}
                        </span>
                      </div>
                      <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>
                        {fmtTime(s.opened_at)}
                        {s.closed_at ? ` → ${fmtTime(s.closed_at)}` : ' → now'}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 12px', borderRadius: 20, ...M, fontSize: 10, letterSpacing: '0.08em',
                      border: `1px solid ${isOpen ? 'rgba(0,212,170,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      color: isOpen ? '#00d4aa' : 'var(--muted)',
                      background: isOpen ? 'rgba(0,212,170,0.08)' : 'transparent',
                    }}>
                      {s.status}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                    {[
                      { label: 'TRANSACTIONS',    value: String(s.txn_count),                                                         color: '#e2e6f0' },
                      { label: 'TOTAL SOLD',       value: php(s.total_sold_php),                                                      color: '#f5a623' },
                      { label: 'TOTAL BOUGHT',     value: php(s.total_bought_php),                                                    color: '#5b8cff' },
                      { label: 'TOTAL THAN',       value: php(s.total_than),                                                          color: '#00d4aa' },
                      ...(s.total_commission !== 0 ? [{ label: 'COMMISSION', value: (s.total_commission > 0 ? '+' : '') + php(s.total_commission), color: '#00d4aa' }] : []),
                      { label: 'OPENING CASH',     value: php(s.opening_cash_php),       color: '#e2e6f0' },
                      ...(s.status === 'CLOSED' ? [
                        { label: 'EXPECTED CASH',  value: php(s.expected_cash_php ?? 0), color: '#e2e6f0' },
                        { label: 'ACTUAL CASH',    value: php(s.closing_cash_php ?? 0),  color: '#e2e6f0' },
                        { label: 'VARIANCE',        value: php(variance),                 color: varColor },
                      ] : []),
                    ].map(item => (
                      <div key={item.label} style={{
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        borderRadius: 10, padding: '12px 14px',
                      }}>
                        <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 6 }}>
                          {item.label}
                        </div>
                        <div style={{ ...Y, fontSize: 15, fontWeight: 700, color: item.color }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
