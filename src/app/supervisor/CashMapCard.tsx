'use client';

import { useEffect, useState } from 'react';

type Row = {
  location: string;
  holder: string;
  amount: number;
  status: string;
  since: string | null;
  terminal_id?: string | null;
  branch_id?: string | null;
};

type CashMap = {
  date: string;
  rollup: {
    cashiers: { drawer: number; handoff: number };
    riders:   { in_field: number; remitted_unconfirmed: number };
    vault: number;
    total: number;
  };
  rows: Row[];
  expected: number | null;
  variance: number | null;
};

const php = (n: number) =>
  '₱' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const LOCATION_ACCENT: Record<string, string> = {
  'Cashier Drawer':   '#00d4aa',
  'Treasurer Drawer': '#00d4aa',
  'Cashier Handoff':  '#f5a623',
  'Rider Field':      '#f5a623',
  'Rider Remit':      '#d4a64a',
  'Vault':            '#5b8cff',
};

export default function CashMapCard() {
  const [data, setData] = useState<CashMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/admin/cash-map', { cache: 'no-store' });
      if (!res.ok) { setError(`HTTP ${res.status}`); return; }
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid #00d4aa33', borderRadius: 14,
      padding: 'clamp(16px, 4vw, 24px)', marginBottom: 20, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg,#00d4aa,transparent)' }} />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 14, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10,
            color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>CASH MAP</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800 }}>
            PHP across all locations
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9,
            color: 'var(--muted)', letterSpacing: '0.15em', marginBottom: 4 }}>TOTAL</div>
          <div data-testid="cash-map-total" style={{ fontFamily: "'DM Mono',monospace",
            fontSize: 22, fontWeight: 800, color: '#00d4aa' }}>
            {data ? php(data.rollup.total) : '—'}
          </div>
        </div>
      </div>

      {loading && !data && (
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>Loading…</div>
      )}
      {error && (
        <div style={{ color: 'var(--accent-coral)', fontSize: 12,
          fontFamily: "'DM Mono',monospace" }}>{error}</div>
      )}

      {data && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10, marginBottom: 14,
          }}>
            <Bucket label="DRAWERS"  amount={data.rollup.cashiers.drawer}            testId="cash-map-drawer"   />
            <Bucket label="HANDOFF"  amount={data.rollup.cashiers.handoff}           testId="cash-map-handoff"  />
            <Bucket label="RIDER FIELD"  amount={data.rollup.riders.in_field}        testId="cash-map-in-field" />
            <Bucket label="RIDER REMIT"  amount={data.rollup.riders.remitted_unconfirmed} testId="cash-map-remit" />
            <Bucket label="VAULT"    amount={data.rollup.vault}                      testId="cash-map-vault"    />
          </div>

          {data.rows.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 11,
              fontFamily: "'DM Mono',monospace", padding: '6px 0' }}>
              No cash movements right now.
            </div>
          ) : (
            <div data-testid="cash-map-rows" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.rows.map((r, i) => (
                <RowItem key={i} row={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Bucket({ label, amount, testId }: { label: string; amount: number; testId: string }) {
  return (
    <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, minWidth: 0 }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9,
        color: 'var(--muted)', letterSpacing: '0.15em', marginBottom: 4 }}>{label}</div>
      <div data-testid={testId} style={{
        fontFamily: "'DM Mono',monospace", fontSize: 15, fontWeight: 700,
        color: 'var(--text-strong)', overflowWrap: 'anywhere',
      }}>
        {php(amount)}
      </div>
    </div>
  );
}

function RowItem({ row }: { row: Row }) {
  const accent = LOCATION_ACCENT[row.location] ?? 'var(--muted)';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto',
      alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 8,
      background: 'var(--bg)', border: '1px solid var(--border)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            letterSpacing: '0.1em', color: accent,
            padding: '2px 6px', borderRadius: 4, border: `1px solid ${accent}55`,
          }}>{row.location.toUpperCase()}</span>
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
            color: 'var(--text-strong)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{row.holder}</span>
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10,
          color: 'var(--muted)', marginTop: 3 }}>
          {row.status}{row.terminal_id ? ` · ${row.terminal_id}` : ''}{row.since ? ` · ${timeAgo(row.since)}` : ''}
        </div>
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700,
        color: 'var(--text-strong)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {php(row.amount)}
      </div>
    </div>
  );
}
