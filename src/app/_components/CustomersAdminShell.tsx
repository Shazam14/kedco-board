'use client';

import { useEffect, useMemo, useState } from 'react';

const M = { fontFamily: '"Inter Tight", "SF Mono", monospace' };
const Y = { fontFamily: 'var(--font-display, "Fraunces", serif)' };

const php = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string | null;
  txn_count: number;
  total_volume_php: number;
  last_txn_date: string | null;
}

type SortKey = 'volume' | 'name' | 'count' | 'last';

export default function CustomersAdminShell() {
  const [rows,            setRows]            = useState<CustomerRow[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [q,               setQ]               = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sortKey,         setSortKey]         = useState<SortKey>('volume');

  useEffect(() => {
    setLoading(true);
    const url = new URL('/api/admin/customers', window.location.origin);
    if (q.trim()) url.searchParams.set('q', q.trim());
    if (includeInactive) url.searchParams.set('include_inactive', 'true');
    url.searchParams.set('limit', '200');
    const ctrl = new AbortController();
    fetch(url.toString(), { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : [])
      .then((data: CustomerRow[]) => { setRows(data); setLoading(false); })
      .catch(() => { /* abort or net */ });
    return () => ctrl.abort();
  }, [q, includeInactive]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name':   return a.name.localeCompare(b.name);
        case 'count':  return b.txn_count - a.txn_count;
        case 'last':   return (b.last_txn_date ?? '').localeCompare(a.last_txn_date ?? '');
        case 'volume':
        default:       return b.total_volume_php - a.total_volume_php;
      }
    });
    return arr;
  }, [rows, sortKey]);

  const totalCustomers = rows.length;
  const totalVolume    = rows.reduce((s, r) => s + r.total_volume_php, 0);
  const totalTxns      = rows.reduce((s, r) => s + r.txn_count, 0);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: 56, borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: -2 }}>Customers</div>
          </div>
        </div>
        <a href="/admin" style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', ...M, fontSize: 11, textDecoration: 'none' }}>← Admin</a>
      </nav>

      <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 6 }}>ADMIN · CUSTOMERS</div>
          <div style={{ ...Y, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Customer Master List</div>
          <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Loyal customers tracked across cashier + rider transactions. Walk-ins remain free-text and don&rsquo;t appear here.
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'CUSTOMERS',     val: totalCustomers.toLocaleString('en-PH'),                color: '#00d4aa' },
            { label: 'TOTAL TXNS',    val: totalTxns.toLocaleString('en-PH'),                     color: '#5b8cff' },
            { label: 'TOTAL VOLUME',  val: php(totalVolume),                                       color: '#f5a623' },
          ].map(s => (
            <div key={s.label} data-testid={`summary-${s.label.toLowerCase().replace(/ /g, '-')}`}
                 style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 4 }}>{s.label}</div>
              <div style={{ ...Y, fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name or phone…"
            data-testid="customers-search"
            style={{ flex: '1 1 280px', minWidth: 240, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none' }}
          />
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            data-testid="customers-sort"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: '#e2e6f0', ...M, fontSize: 12, outline: 'none' }}
          >
            <option value="volume">Sort: Volume ↓</option>
            <option value="count">Sort: Txn count ↓</option>
            <option value="last">Sort: Last seen ↓</option>
            <option value="name">Sort: Name A–Z</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...M, fontSize: 11, color: 'var(--muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={e => setIncludeInactive(e.target.checked)}
              data-testid="customers-include-inactive"
            />
            include inactive
          </label>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', ...M, fontSize: 12 }}>Loading…</div>
          ) : sorted.length === 0 ? (
            <div data-testid="customers-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', ...M, fontSize: 12 }}>
              {q ? `No customers matching "${q}"` : 'No customers yet — they get added from cashier and rider transaction forms.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...M, fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Phone', 'Txns', 'Volume', 'Last seen', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Volume' || h === 'Txns' ? 'right' : 'left', padding: '10px 16px', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', fontWeight: 600 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id} data-testid={`customer-row-${r.id}`}
                      style={{ borderBottom: '1px solid var(--border)', opacity: r.is_active ? 1 : 0.55 }}>
                    <td style={{ padding: '12px 16px', color: '#e2e6f0', fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{r.phone ?? '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#e2e6f0' }}>{r.txn_count.toLocaleString('en-PH')}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: r.total_volume_php > 0 ? '#f5a623' : 'var(--muted)' }}>{php(r.total_volume_php)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{r.last_txn_date ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {r.is_active ? (
                        <span style={{ fontSize: 9, padding: '3px 7px', borderRadius: 4, background: 'rgba(0,212,170,0.12)', color: '#00d4aa' }}>ACTIVE</span>
                      ) : (
                        <span style={{ fontSize: 9, padding: '3px 7px', borderRadius: 4, background: 'rgba(255,92,92,0.10)', color: '#ff8b8b' }}>INACTIVE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 12 }}>
          Merge dupes & per-customer detail page coming next. Cashiers + riders can keep adding from the txn forms in the meantime.
        </div>
      </div>
    </div>
  );
}
