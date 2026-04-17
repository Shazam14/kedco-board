'use client';

import { useState, useEffect, useCallback } from 'react';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

type EditRequest = {
  id:             string;
  txn_id:         string;
  txn_date:       string;
  requested_by:   string;
  current_values: Record<string, unknown>;
  proposed:       Record<string, unknown>;
  note:           string | null;
  status:         'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by:    string | null;
  reviewed_at:    string | null;
  rejection_note: string | null;
  created_at:     string;
};

const STATUS_TABS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const;

const STATUS_COLOR: Record<string, string> = {
  PENDING:  '#f5a623',
  APPROVED: '#00d4aa',
  REJECTED: '#ff5c5c',
};

function fmtTs(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function EditRequestsShell() {
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<typeof STATUS_TABS[number]>('PENDING');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy,     setBusy]     = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const qs = tab === 'ALL' ? '' : `?status=${tab}`;
      const res = await fetch(`/api/admin/edit-requests${qs}`);
      if (res.ok) setRequests(await res.json());
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function approve(id: string) {
    setBusy(id); setActionError(null);
    try {
      const res = await fetch(`/api/admin/edit-requests/${id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setActionError(data.detail ?? 'Failed'); return; }
      await fetchRequests();
      setExpanded(null);
    } finally { setBusy(null); }
  }

  async function reject(id: string) {
    setBusy(id); setActionError(null);
    try {
      const res = await fetch(`/api/admin/edit-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejection_note: rejectNote || null }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.detail ?? 'Failed'); return; }
      setRejectId(null); setRejectNote('');
      await fetchRequests();
      setExpanded(null);
    } finally { setBusy(null); }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 300,
    background: 'rgba(7,9,13,0.92)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>

      {/* Reject modal */}
      {rejectId && (
        <div style={overlayStyle}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 32, width: '100%', maxWidth: 420,
          }}>
            <div style={{ ...Y, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Reject Request</div>
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 20 }}>
              Optional — leave a reason so the cashier knows what to fix.
            </div>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: '#e2e6f0',
                ...M, fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            {actionError && (
              <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginTop: 10 }}>✗ {actionError}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => { setRejectId(null); setRejectNote(''); setActionError(null); }}
                style={{ padding: '11px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', ...M, fontSize: 12, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={() => reject(rejectId)}
                disabled={!!busy}
                style={{ padding: '11px', borderRadius: 8, border: 'none', background: busy ? 'var(--border)' : 'linear-gradient(135deg,#ff5c5c,#cc3333)', color: busy ? 'var(--muted)' : '#fff', ...Y, fontSize: 13, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}
              >{busy ? 'REJECTING...' : 'CONFIRM REJECT'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>
          ADMIN · APPROVALS
        </div>
        <div style={{ ...Y, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Edit Requests
        </div>
        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
          Review cashier transaction edits — approve to apply, reject to deny.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUS_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${tab === t ? (STATUS_COLOR[t] ?? 'rgba(0,212,170,0.5)') + '80' : 'var(--border)'}`,
            background: tab === t ? (STATUS_COLOR[t] ?? 'rgba(0,212,170,0.1)') + '18' : 'transparent',
            color: tab === t ? (STATUS_COLOR[t] ?? '#00d4aa') : 'var(--muted)',
            ...M, fontSize: 10,
          }}>{t}</button>
        ))}
        <button onClick={fetchRequests} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', ...M, fontSize: 10, cursor: 'pointer', marginLeft: 'auto' }}>
          ↺ Refresh
        </button>
      </div>

      {/* List */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '130px 110px 100px 80px 1fr',
          padding: '10px 20px', borderBottom: '1px solid var(--border)',
          ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em',
        }}>
          <span>WHEN</span><span>TRANSACTION</span><span>CASHIER</span><span>STATUS</span><span>CHANGES</span>
        </div>

        {loading && (
          <div style={{ padding: '48px 20px', textAlign: 'center', ...M, fontSize: 11, color: 'var(--muted)' }}>Loading…</div>
        )}
        {!loading && requests.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center', ...M, fontSize: 11, color: 'var(--muted)' }}>
            No {tab === 'ALL' ? '' : tab.toLowerCase() + ' '}requests.
          </div>
        )}

        {!loading && requests.map((r, i) => {
          const isOpen = expanded === r.id;
          const sc     = STATUS_COLOR[r.status] ?? '#7a8ba8';
          const changeKeys = Object.keys(r.proposed);

          return (
            <div key={r.id}>
              <div
                onClick={() => setExpanded(prev => prev === r.id ? null : r.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '130px 110px 100px 80px 1fr',
                  padding: '12px 20px', alignItems: 'center', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: isOpen ? 'rgba(255,255,255,0.025)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                }}
              >
                <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{fmtTs(r.created_at)}</span>
                <span style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>{r.txn_id}</span>
                <span style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>{r.requested_by}</span>
                <span style={{
                  ...M, fontSize: 10, fontWeight: 700,
                  color: sc, background: sc + '18',
                  padding: '2px 7px', borderRadius: 4, display: 'inline-block',
                }}>{r.status}</span>
                <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>
                  {changeKeys.join(', ')}
                  {r.note ? <span style={{ color: '#7a8ba8' }}> · "{r.note}"</span> : null}
                </span>
              </div>

              {isOpen && (
                <div style={{ padding: '18px 24px 22px', background: 'rgba(0,0,0,0.18)', borderBottom: '1px solid var(--border)' }}>

                  {/* Field diff table */}
                  <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 10 }}>PROPOSED CHANGES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                    {changeKeys.map(k => (
                      <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'baseline', ...M, fontSize: 11 }}>
                        <span style={{ color: 'var(--muted)', minWidth: 120 }}>{k}</span>
                        <span style={{ color: '#ff5c5c', textDecoration: 'line-through' }}>
                          {JSON.stringify(r.current_values[k])}
                        </span>
                        <span style={{ color: 'var(--muted)' }}>→</span>
                        <span style={{ color: '#00d4aa' }}>
                          {JSON.stringify(r.proposed[k])}
                        </span>
                      </div>
                    ))}
                  </div>

                  {r.note && (
                    <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
                      Note: <span style={{ color: '#e2e6f0' }}>{r.note}</span>
                    </div>
                  )}

                  {r.status === 'REJECTED' && r.rejection_note && (
                    <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginBottom: 16 }}>
                      Rejection reason: {r.rejection_note}
                    </div>
                  )}

                  {r.status === 'APPROVED' && (
                    <div style={{ ...M, fontSize: 11, color: '#00d4aa', marginBottom: 16 }}>
                      Approved by {r.reviewed_by} · {r.reviewed_at ? fmtTs(r.reviewed_at) : ''}
                    </div>
                  )}

                  {actionError && busy === r.id && (
                    <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginBottom: 12 }}>✗ {actionError}</div>
                  )}

                  {r.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={e => { e.stopPropagation(); approve(r.id); }}
                        disabled={!!busy}
                        style={{
                          padding: '9px 24px', borderRadius: 8, border: 'none',
                          background: busy === r.id ? 'var(--border)' : 'linear-gradient(135deg,#00d4aa,#00a884)',
                          color: busy === r.id ? 'var(--muted)' : '#000',
                          ...Y, fontSize: 12, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer',
                        }}
                      >{busy === r.id ? 'PROCESSING...' : '✓ APPROVE'}</button>
                      <button
                        onClick={e => { e.stopPropagation(); setRejectId(r.id); setRejectNote(''); setActionError(null); }}
                        disabled={!!busy}
                        style={{
                          padding: '9px 24px', borderRadius: 8,
                          border: '1px solid rgba(255,92,92,0.4)',
                          background: 'rgba(255,92,92,0.08)', color: '#ff5c5c',
                          ...M, fontSize: 12, cursor: busy ? 'not-allowed' : 'pointer',
                        }}
                      >✕ Reject</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!loading && requests.length > 0 && (
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 12, textAlign: 'right' }}>
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
