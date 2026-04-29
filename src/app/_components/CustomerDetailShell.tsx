'use client';

import { useEffect, useState } from 'react';

const M = { fontFamily: '"Inter Tight", "SF Mono", monospace' };
const Y = { fontFamily: 'var(--font-display, "Fraunces", serif)' };

const php = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');
const fxFmt = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 4 });

interface Customer {
  id: string; name: string; phone: string | null; notes: string | null;
  is_active: boolean; created_by: string | null; created_at: string | null;
}
interface Stats {
  txn_count: number; total_volume_php: number;
  last_txn_date: string | null; first_txn_date: string | null;
}
interface CurrencyRow { currency: string; txn_count: number; total_foreign: number; total_php: number }
interface PeriodRow   { period: string; txn_count: number; total_php: number }
interface RecentTxn   {
  id: string; date: string; time: string; type: string; source: string;
  currency: string; foreign_amt: number; rate: number; php_amt: number;
  than: number; cashier: string; payment_status: string;
}
interface DetailPayload {
  customer: Customer;
  stats: Stats;
  currency_mix: CurrencyRow[];
  weekly: PeriodRow[];
  annual: PeriodRow[];
  recent_transactions: RecentTxn[];
}

export default function CustomerDetailShell({ customerId }: { customerId: string }) {
  const [data,    setData]    = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/customers/${customerId}/detail`)
      .then(async r => {
        if (!r.ok) {
          setError(r.status === 404 ? 'Customer not found' : 'Failed to load');
          setLoading(false);
          return;
        }
        const body = await r.json();
        setData(body);
        setLoading(false);
      })
      .catch(() => { setError('Network error'); setLoading(false); });
  }, [customerId]);

  if (loading) {
    return (
      <Page>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', ...M, fontSize: 12 }}>Loading…</div>
      </Page>
    );
  }
  if (error || !data) {
    return (
      <Page>
        <div data-testid="detail-error" style={{ padding: 40, textAlign: 'center', color: '#ff8b8b', ...M, fontSize: 12 }}>{error ?? 'No data'}</div>
      </Page>
    );
  }

  const { customer, stats, currency_mix, weekly, annual, recent_transactions } = data;

  return (
    <Page>
      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.16em', marginBottom: 6 }}>
          ADMIN · <a href="/admin/customers" style={{ color: 'var(--muted)', textDecoration: 'none' }}>CUSTOMERS</a> · DETAIL
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <div data-testid="detail-name" style={{ ...Y, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{customer.name}</div>
            {customer.is_active ? (
              <span style={{ ...M, fontSize: 9, padding: '3px 7px', borderRadius: 4, background: 'rgba(0,212,170,0.12)', color: '#00d4aa' }}>ACTIVE</span>
            ) : (
              <span style={{ ...M, fontSize: 9, padding: '3px 7px', borderRadius: 4, background: 'rgba(255,92,92,0.10)', color: '#ff8b8b' }}>INACTIVE</span>
            )}
          </div>
          <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            {customer.phone ?? 'no phone on file'}
            {customer.notes ? ` · ${customer.notes}` : ''}
            {customer.created_at ? ` · added ${customer.created_at.slice(0, 10)}${customer.created_by ? ` by ${customer.created_by}` : ''}` : ''}
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'TOTAL VOLUME', val: php(stats.total_volume_php),                color: '#f5a623', testid: 'detail-stat-volume' },
            { label: 'TRANSACTIONS', val: stats.txn_count.toLocaleString('en-PH'),    color: '#00d4aa', testid: 'detail-stat-count' },
            { label: 'FIRST SEEN',   val: stats.first_txn_date ?? '—',                color: '#5b8cff', testid: 'detail-stat-first' },
            { label: 'LAST SEEN',    val: stats.last_txn_date  ?? '—',                color: '#a78bfa', testid: 'detail-stat-last' },
          ].map(s => (
            <div key={s.label} data-testid={s.testid}
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ ...Y, fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Currency mix */}
        <SectionHeader title="Currency mix" subtitle="Where this customer's volume sits" />
        <Card>
          {currency_mix.length === 0 ? (
            <Empty>No transactions yet — customer was added but never linked on a txn.</Empty>
          ) : (
            <Table headers={['Currency', 'Txns', 'Foreign total', 'PHP total']} rightAlign={[1, 2, 3]}>
              {currency_mix.map(r => (
                <tr key={r.currency} data-testid={`detail-currency-${r.currency}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <Cell><strong>{r.currency}</strong></Cell>
                  <Cell right>{r.txn_count}</Cell>
                  <Cell right>{fxFmt(r.total_foreign)} {r.currency}</Cell>
                  <Cell right gold>{php(r.total_php)}</Cell>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {/* Weekly + Annual side-by-side on wide screens */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginTop: 24 }}>
          <div>
            <SectionHeader title="Weekly (last 12)" subtitle="Most recent week first" />
            <Card>
              {weekly.length === 0 ? (
                <Empty>No weekly history.</Empty>
              ) : (
                <Table headers={['Week of', 'Txns', 'Volume']} rightAlign={[1, 2]}>
                  {weekly.map(w => (
                    <tr key={w.period} data-testid={`detail-week-${w.period.slice(0, 10)}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <Cell>{w.period.slice(0, 10)}</Cell>
                      <Cell right>{w.txn_count}</Cell>
                      <Cell right gold>{php(w.total_php)}</Cell>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </div>
          <div>
            <SectionHeader title="Annual (last 5 years)" subtitle="Most recent year first" />
            <Card>
              {annual.length === 0 ? (
                <Empty>No annual history.</Empty>
              ) : (
                <Table headers={['Year', 'Txns', 'Volume']} rightAlign={[1, 2]}>
                  {annual.map(a => (
                    <tr key={a.period} data-testid={`detail-year-${a.period.slice(0, 4)}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <Cell>{a.period.slice(0, 4)}</Cell>
                      <Cell right>{a.txn_count}</Cell>
                      <Cell right gold>{php(a.total_php)}</Cell>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </div>
        </div>

        {/* Recent transactions */}
        <div style={{ marginTop: 24 }}>
          <SectionHeader title="Recent transactions (last 50)" subtitle="Most recent first — RECEIVED only" />
          <Card>
            {recent_transactions.length === 0 ? (
              <Empty>No transactions yet.</Empty>
            ) : (
              <Table headers={['Date', 'Time', 'Type', 'Src', 'Currency', 'Foreign', 'Rate', 'PHP', 'Cashier']} rightAlign={[5, 6, 7]}>
                {recent_transactions.map(t => (
                  <tr key={t.id} data-testid={`detail-txn-${t.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <Cell>{t.date}</Cell>
                    <Cell>{t.time}</Cell>
                    <Cell>
                      <span style={{ ...M, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: t.type === 'BUY' ? 'rgba(91,140,255,0.15)' : 'rgba(245,166,35,0.15)', color: t.type === 'BUY' ? '#5b8cff' : '#f5a623' }}>{t.type}</span>
                    </Cell>
                    <Cell>{t.source}</Cell>
                    <Cell><strong>{t.currency}</strong></Cell>
                    <Cell right>{fxFmt(t.foreign_amt)}</Cell>
                    <Cell right>{t.rate.toFixed(4)}</Cell>
                    <Cell right gold>{php(t.php_amt)}</Cell>
                    <Cell>{t.cashier}</Cell>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: 56, borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: -2 }}>Customer detail</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/admin/customers" style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', ...M, fontSize: 11, textDecoration: 'none' }}>← Customers</a>
          <a href="/admin" style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', ...M, fontSize: 11, textDecoration: 'none' }}>Admin</a>
        </div>
      </nav>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ ...Y, fontSize: 16, fontWeight: 800 }}>{title}</div>
      {subtitle && <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', ...M, fontSize: 12 }}>{children}</div>
  );
}

function Table({ headers, rightAlign = [], children }: { headers: string[]; rightAlign?: number[]; children: React.ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', ...M, fontSize: 12 }}>
      <thead>
        <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
          {headers.map((h, i) => (
            <th key={h} style={{ textAlign: rightAlign.includes(i) ? 'right' : 'left', padding: '10px 16px', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', fontWeight: 600 }}>
              {h.toUpperCase()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Cell({ children, right, gold }: { children: React.ReactNode; right?: boolean; gold?: boolean }) {
  return (
    <td style={{ padding: '10px 16px', textAlign: right ? 'right' : 'left', color: gold ? '#f5a623' : '#e2e6f0' }}>{children}</td>
  );
}
