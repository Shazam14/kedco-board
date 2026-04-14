'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  type AuditEntry, type AuditAction,
  actionColor, actionLabel, tableLabel, formatTimestamp, diffValues, summariseEntry,
} from '@/lib/auditFormat';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const TABLES  = ['ALL', 'transactions', 'rates', 'positions', 'dispatches', 'users'] as const;
const ACTIONS = ['ALL', 'CREATE', 'UPDATE', 'DELETE'] as const;

export default function AuditLogShell() {
  const [entries,   setEntries]   = useState<AuditEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState<string | null>(null);

  // Filters
  const [tableF,  setTableF]  = useState<string>('ALL');
  const [actionF, setActionF] = useState<string>('ALL');
  const [userF,   setUserF]   = useState('');

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tableF  !== 'ALL') params.set('table',  tableF);
      if (actionF !== 'ALL') params.set('action', actionF);
      if (userF.trim())      params.set('user',   userF.trim());
      params.set('limit', '200');

      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setEntries(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [tableF, actionF, userF]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const toggleExpand = (id: string) =>
    setExpanded(prev => (prev === id ? null : id));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>
          ADMIN · AUDIT TRAIL
        </div>
        <div style={{ ...Y, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Audit Log
        </div>
        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          Every create, edit, and delete — who did it and when.
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '16px 20px', marginBottom: 20,
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end',
      }}>
        {/* Table filter */}
        <div>
          <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 6 }}>TABLE</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {TABLES.map(t => (
              <button key={t} onClick={() => setTableF(t)} style={{
                padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${tableF === t ? 'rgba(0,212,170,0.5)' : 'var(--border)'}`,
                background: tableF === t ? 'rgba(0,212,170,0.1)' : 'transparent',
                color: tableF === t ? '#00d4aa' : 'var(--muted)',
                ...M, fontSize: 10,
              }}>{t === 'ALL' ? 'ALL' : tableLabel(t)}</button>
            ))}
          </div>
        </div>

        {/* Action filter */}
        <div>
          <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 6 }}>ACTION</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {ACTIONS.map(a => (
              <button key={a} onClick={() => setActionF(a)} style={{
                padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${actionF === a ? actionColor(a as AuditAction) + '80' : 'var(--border)'}`,
                background: actionF === a ? actionColor(a as AuditAction) + '18' : 'transparent',
                color: actionF === a ? actionColor(a as AuditAction) : 'var(--muted)',
                ...M, fontSize: 10,
              }}>{a}</button>
            ))}
          </div>
        </div>

        {/* User filter */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 6 }}>USER</div>
          <input
            type="text"
            value={userF}
            onChange={e => setUserF(e.target.value)}
            placeholder="Filter by username…"
            style={{
              width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '6px 10px', color: '#e2e6f0',
              ...M, fontSize: 11, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <button onClick={fetchAudit} style={{
          padding: '7px 16px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--muted)', ...M, fontSize: 10, cursor: 'pointer',
        }}>↺ Refresh</button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          ...M, fontSize: 11, color: '#ff5c5c',
          background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.2)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
        }}>✗ {error}</div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 80px 100px 100px 1fr 32px',
          padding: '10px 20px', borderBottom: '1px solid var(--border)',
          ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em',
        }}>
          <span>WHEN</span>
          <span>ACTION</span>
          <span>TABLE</span>
          <span>BY</span>
          <span>SUMMARY</span>
          <span />
        </div>

        {loading && (
          <div style={{ padding: '48px 20px', textAlign: 'center', ...M, fontSize: 11, color: 'var(--muted)' }}>
            Loading…
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center', ...M, fontSize: 11, color: 'var(--muted)' }}>
            No audit entries found for the current filters.
          </div>
        )}

        {!loading && entries.map((e, i) => {
          const isOpen = expanded === e.id;
          const diffs  = diffValues(e.old_value, e.new_value);
          const color  = actionColor(e.action);

          return (
            <div key={e.id}>
              {/* Row */}
              <div
                onClick={() => toggleExpand(e.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 80px 100px 100px 1fr 32px',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: isOpen
                    ? 'rgba(255,255,255,0.025)'
                    : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>
                  {formatTimestamp(e.changed_at)}
                </span>
                <span style={{
                  ...M, fontSize: 10, fontWeight: 700,
                  color, background: color + '18',
                  padding: '2px 7px', borderRadius: 4, display: 'inline-block',
                }}>
                  {actionLabel(e.action)}
                </span>
                <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>
                  {tableLabel(e.table)}
                </span>
                <span style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>
                  {e.changed_by}
                </span>
                <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>
                  {e.note ?? summariseEntry(e)}
                </span>
                <span style={{ ...M, fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
                  {(e.old_value || e.new_value) ? (isOpen ? '▲' : '▼') : ''}
                </span>
              </div>

              {/* Expanded diff */}
              {isOpen && (
                <div style={{
                  padding: '14px 24px 18px',
                  background: 'rgba(0,0,0,0.18)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 10 }}>
                    RECORD: {e.record_id}
                  </div>

                  {/* CREATE — show new values */}
                  {e.action === 'CREATE' && e.new_value && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(e.new_value).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: 16, ...M, fontSize: 11 }}>
                          <span style={{ color: 'var(--muted)', minWidth: 140 }}>{k}</span>
                          <span style={{ color: '#00d4aa' }}>{JSON.stringify(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* DELETE — show old values */}
                  {e.action === 'DELETE' && e.old_value && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(e.old_value).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: 16, ...M, fontSize: 11 }}>
                          <span style={{ color: 'var(--muted)', minWidth: 140 }}>{k}</span>
                          <span style={{ color: '#ff5c5c' }}>{JSON.stringify(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* UPDATE — show field diffs */}
                  {e.action === 'UPDATE' && diffs.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {diffs.map(d => (
                        <div key={d.field} style={{ display: 'flex', gap: 12, alignItems: 'baseline', ...M, fontSize: 11 }}>
                          <span style={{ color: 'var(--muted)', minWidth: 140 }}>{d.field}</span>
                          <span style={{ color: '#ff5c5c', textDecoration: 'line-through' }}>
                            {JSON.stringify(d.oldValue)}
                          </span>
                          <span style={{ color: 'var(--muted)' }}>→</span>
                          <span style={{ color: '#00d4aa' }}>
                            {JSON.stringify(d.newValue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {e.action === 'UPDATE' && diffs.length === 0 && (
                    <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>No field changes recorded.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Count */}
      {!loading && entries.length > 0 && (
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 12, textAlign: 'right' }}>
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
        </div>
      )}
    </div>
  );
}
