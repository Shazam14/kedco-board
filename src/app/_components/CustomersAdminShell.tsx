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

export default function CustomersAdminShell({ canMerge = false }: { canMerge?: boolean }) {
  const [rows,            setRows]            = useState<CustomerRow[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [q,               setQ]               = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sortKey,         setSortKey]         = useState<SortKey>('volume');
  const [selected,        setSelected]        = useState<Set<string>>(new Set());
  const [mergeOpen,       setMergeOpen]       = useState(false);
  const [canonicalId,     setCanonicalId]     = useState<string | null>(null);
  const [merging,         setMerging]         = useState(false);
  const [mergeError,      setMergeError]      = useState<string | null>(null);
  const [reloadTick,      setReloadTick]      = useState(0);

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
  }, [q, includeInactive, reloadTick]);

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openMergeModal() {
    if (selected.size < 2) return;
    // Default canonical = the selected row with the highest volume
    const ranked = [...selected]
      .map(id => rows.find(r => r.id === id))
      .filter((r): r is CustomerRow => !!r)
      .sort((a, b) => b.total_volume_php - a.total_volume_php);
    setCanonicalId(ranked[0]?.id ?? null);
    setMergeError(null);
    setMergeOpen(true);
  }

  async function confirmMerge() {
    if (!canonicalId) return;
    const dupes = [...selected].filter(id => id !== canonicalId);
    if (dupes.length === 0) {
      setMergeError('Pick a different canonical — at least one dupe must remain selected');
      return;
    }
    setMerging(true);
    setMergeError(null);
    try {
      const res = await fetch(`/api/admin/customers/${canonicalId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicate_ids: dupes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMergeError(typeof data?.detail === 'string' ? data.detail : 'Merge failed');
        return;
      }
      // Success — close, clear selection, reload
      setMergeOpen(false);
      setSelected(new Set());
      setCanonicalId(null);
      setReloadTick(t => t + 1);
    } finally {
      setMerging(false);
    }
  }

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
                  {canMerge && <th style={{ width: 36 }}></th>}
                  {['Name', 'Phone', 'Txns', 'Volume', 'Last seen', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Volume' || h === 'Txns' ? 'right' : 'left', padding: '10px 16px', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', fontWeight: 600 }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => (
                  <tr key={r.id} data-testid={`customer-row-${r.id}`}
                      style={{ borderBottom: '1px solid var(--border)', opacity: r.is_active ? 1 : 0.55,
                               background: selected.has(r.id) ? 'rgba(245,166,35,0.06)' : 'transparent' }}>
                    {canMerge && (
                      <td style={{ padding: '12px 16px' }}>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelected(r.id)}
                          disabled={!r.is_active}
                          data-testid={`select-${r.id}`}
                          aria-label={`Select ${r.name} for merge`}
                        />
                      </td>
                    )}
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
          {canMerge
            ? 'Tip: select two or more rows to merge dupes — Hannah Wu + Hanna Wuu collapse into one customer with all txns intact.'
            : 'Merge & per-customer detail are admin-only. Cashiers + riders can keep adding from the txn forms.'}
        </div>
      </div>

      {/* Merge floating action bar */}
      {canMerge && selected.size >= 2 && !mergeOpen && (
        <div data-testid="merge-bar"
             style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1d27', border: '1px solid rgba(245,166,35,0.5)', borderRadius: 12, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.5)', zIndex: 90 }}>
          <span style={{ ...M, fontSize: 12, color: '#e2e6f0' }}>{selected.size} customers selected</span>
          <button
            onClick={() => setSelected(new Set())}
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--muted)', ...M, fontSize: 11, cursor: 'pointer' }}
          >
            Clear
          </button>
          <button
            data-testid="open-merge"
            onClick={openMergeModal}
            style={{ background: 'linear-gradient(135deg,#f5a623,#e09000)', border: 'none', borderRadius: 6, padding: '8px 16px', color: '#000', ...Y, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
          >
            🔗 MERGE…
          </button>
        </div>
      )}

      {/* Merge modal */}
      {canMerge && mergeOpen && (
        <div data-testid="merge-modal"
             style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
             onClick={e => { if (e.target === e.currentTarget) setMergeOpen(false); }}>
          <div style={{ background: '#1a1d27', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ ...Y, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Merge customers</div>
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 18 }}>
              Pick the customer to keep. The others get marked inactive and their transactions repoint to the canonical one.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {[...selected]
                .map(id => rows.find(r => r.id === id))
                .filter((r): r is CustomerRow => !!r)
                .map(r => (
                  <label key={r.id}
                         data-testid={`canonical-radio-${r.id}`}
                         style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1px solid ${canonicalId === r.id ? 'rgba(245,166,35,0.5)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', background: canonicalId === r.id ? 'rgba(245,166,35,0.06)' : 'transparent' }}>
                    <input
                      type="radio"
                      name="canonical"
                      checked={canonicalId === r.id}
                      onChange={() => setCanonicalId(r.id)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ ...M, fontSize: 13, fontWeight: 700, color: '#e2e6f0' }}>{r.name}</div>
                      <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        {r.phone ?? 'no phone'} · {r.txn_count} txns · {php(r.total_volume_php)}
                      </div>
                    </div>
                    {canonicalId === r.id && (
                      <span style={{ ...M, fontSize: 9, color: '#f5a623', letterSpacing: '0.1em' }}>★ KEEP</span>
                    )}
                  </label>
                ))}
            </div>

            {mergeError && (
              <div data-testid="merge-error" style={{ ...M, fontSize: 11, color: '#ff8b8b', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                {mergeError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setMergeOpen(false)}
                disabled={merging}
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '12px', color: 'var(--muted)', ...M, fontSize: 12, cursor: merging ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                data-testid="confirm-merge"
                onClick={confirmMerge}
                disabled={merging || !canonicalId}
                style={{ flex: 2, background: merging ? 'var(--border)' : 'linear-gradient(135deg,#f5a623,#e09000)', border: 'none', borderRadius: 8, padding: '12px', color: merging ? 'var(--muted)' : '#000', ...Y, fontSize: 13, fontWeight: 800, cursor: merging ? 'wait' : 'pointer' }}
              >
                {merging ? 'Merging…' : `MERGE ${selected.size - (canonicalId ? 1 : 0)} INTO 1`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
