'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type CommissionRow = {
  id: string;
  date: string;
  time: string;
  type: 'BUY' | 'SELL';
  cashier: string;
  currency: string;
  foreign_amt: number;
  rate: number;
  official_rate: number;
  referrer?: string;
};

function calcCommission(row: CommissionRow): number {
  return row.type === 'SELL'
    ? (row.rate - row.official_rate) * row.foreign_amt
    : (row.official_rate - row.rate) * row.foreign_amt;
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CommissionLogPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');

  function load(from?: string, to?: string) {
    setLoading(true);
    const qs = new URLSearchParams();
    if (from) qs.set('date_from', from);
    if (to)   qs.set('date_to', to);
    fetch(`/api/admin/commissions${qs.toString() ? `?${qs}` : ''}`, { cache: 'no-store' })
      .then(r => { if (r.status === 403) router.push('/login'); return r.json(); })
      .then(data => { if (Array.isArray(data)) setRows(data); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const totalComm = rows.reduce((s, r) => s + calcCommission(r), 0);

  const th: React.CSSProperties = {
    ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em',
    padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    ...M, fontSize: 11, padding: '10px 12px', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '56px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--nav-bg)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg,#00d4aa,#00a884)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#000',
          }}>K</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e6f0', fontFamily: "'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: -2 }}>Commission Log</div>
          </div>
        </div>
        <a href="/admin" style={{
          padding: '6px 16px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--muted)', ...M, fontSize: 11, textDecoration: 'none',
        }}>← Admin</a>
      </nav>

      <div style={{ padding: '28px 32px' }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 6 }}>ADMIN</div>
        <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 24, letterSpacing: '-0.02em' }}>Commission Log</div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 4 }}>FROM</div>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ ...M, fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: '#e2e6f0', padding: '6px 10px' }}
            />
          </div>
          <div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 4 }}>TO</div>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ ...M, fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: '#e2e6f0', padding: '6px 10px' }}
            />
          </div>
          <button
            onClick={() => load(dateFrom || undefined, dateTo || undefined)}
            style={{ ...M, fontSize: 11, background: 'var(--teal-500)', color: '#000', border: 'none', borderRadius: 6, padding: '8px 20px', cursor: 'pointer' }}
          >
            Apply
          </button>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); load(); }}
              style={{ ...M, fontSize: 11, background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Summary */}
        {!loading && rows.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px' }}>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 4 }}>TOTAL ENTRIES</div>
              <div style={{ ...Y, fontSize: 18, fontWeight: 700 }}>{rows.length}</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 10, padding: '14px 20px' }}>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 4 }}>TOTAL COMMISSION</div>
              <div style={{ ...Y, fontSize: 18, fontWeight: 700, color: 'var(--teal-300)' }}>{php(totalComm)}</div>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)', padding: 32, textAlign: 'center' }}>Loading...</div>
          ) : rows.length === 0 ? (
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)', padding: 32, textAlign: 'center' }}>No commission entries found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>DATE</th>
                    <th style={th}>TIME</th>
                    <th style={th}>OR#</th>
                    <th style={th}>CASHIER</th>
                    <th style={th}>TYPE</th>
                    <th style={th}>CCY</th>
                    <th style={{ ...th, textAlign: 'right' }}>AMOUNT</th>
                    <th style={{ ...th, textAlign: 'right' }}>RATE</th>
                    <th style={{ ...th, textAlign: 'right' }}>GUIDE RATE</th>
                    <th style={{ ...th, textAlign: 'right' }}>COMMISSION</th>
                    <th style={th}>GUIDE / REFERRER</th>
                    <th style={{ ...th, textAlign: 'right' }}>CASHIER CUT</th>
                    <th style={{ ...th, textAlign: 'right' }}>GUIDE CUT</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const comm      = calcCommission(row);
                    const cashierCut = row.referrer ? comm / 2 : comm;
                    const guideCut   = row.referrer ? comm / 2 : 0;
                    return (
                      <tr key={row.id} style={{ background: 'transparent' }}>
                        <td style={td}>{fmtDate(row.date)}</td>
                        <td style={td}>{row.time}</td>
                        <td style={{ ...td, color: 'var(--muted)' }}>{row.id}</td>
                        <td style={td}>{row.cashier}</td>
                        <td style={td}>
                          <span style={{
                            fontSize: 9, letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 4,
                            background: row.type === 'SELL' ? 'rgba(0,212,170,0.12)' : 'rgba(91,140,255,0.12)',
                            color: row.type === 'SELL' ? 'var(--teal-300)' : '#5b8cff',
                          }}>{row.type}</span>
                        </td>
                        <td style={{ ...td, fontWeight: 700 }}>{row.currency}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{row.foreign_amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{row.rate.toFixed(4)}</td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--muted)' }}>{row.official_rate.toFixed(4)}</td>
                        <td style={{ ...td, textAlign: 'right', color: comm >= 0 ? 'var(--teal-300)' : '#ee6c5a', fontWeight: 700 }}>
                          {comm >= 0 ? '+' : ''}{php(comm)}
                        </td>
                        <td style={{ ...td, color: row.referrer ? '#e2e6f0' : 'var(--muted)' }}>
                          {row.referrer ?? '—'}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{php(cashierCut)}</td>
                        <td style={{ ...td, textAlign: 'right', color: guideCut > 0 ? '#e2e6f0' : 'var(--muted)' }}>
                          {guideCut > 0 ? php(guideCut) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
