'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };
const php = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtAmt(val: string) {
  const raw = val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  const [i, d] = raw.split('.');
  const fmt = (i || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return d !== undefined ? `${fmt}.${d}` : fmt;
}

interface Rider    { username: string; full_name: string; }
interface Dispatch {
  id: string; rider_username: string; rider_name: string;
  status: string; dispatch_time: string | null; return_time: string | null;
  cash_php: number; notes: string | null; dispatched_by: string | null;
}
interface Borrow   { id: string; source_type: string; source_name: string; amount_php: number; is_returned: string; notes: string | null; }

interface RiderTxn {
  id: string; time: string; type: string; currency: string;
  foreignAmt: number; rate: number; phpAmt: number; than: number;
  paymentMode: string; bankId: number | null; paymentStatus: string;
  customer?: string;
}

export default function RidersAdminShell({ dispatches: initial, riders }: { dispatches: Dispatch[]; riders: Rider[] }) {
  const router = useRouter();
  const [dispatches, setDispatches] = useState<Dispatch[]>(initial);
  const [selected,   setSelected]   = useState<Dispatch | null>(null);
  const [borrows,    setBorrows]     = useState<Borrow[]>([]);
  const [txns,       setTxns]        = useState<RiderTxn[]>([]);
  const [tab,        setTab]         = useState<'txns' | 'borrows'>('txns');

  // Dispatch form
  const [selRider,   setSelRider]    = useState('');
  const [cashAmt,    setCashAmt]     = useState('');
  const [notes,      setNotes]       = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispError,  setDispError]   = useState<string | null>(null);

  // Borrow mark-returned
  const [returning,  setReturning]   = useState<string | null>(null);

  const undispatched = riders.filter(r =>
    !dispatches.find(d => d.rider_username === r.username && d.status === 'IN_FIELD')
  );

  const loadDetail = useCallback(async (d: Dispatch) => {
    setSelected(d);
    const [bRes, tRes] = await Promise.all([
      fetch(`/api/admin/rider/borrows?dispatch_id=${d.id}`),
      fetch(`/api/counter/transactions`),
    ]);
    if (bRes.ok) setBorrows(await bRes.json());
    if (tRes.ok) {
      const all = await tRes.json();
      setTxns(all.filter((t: RiderTxn & { source: string; cashier: string }) =>
        t.source === 'RIDER' && t.cashier === d.rider_username
      ));
    }
  }, []);

  async function handleDispatch() {
    if (!selRider || !cashAmt) return;
    setDispatching(true); setDispError(null);
    const res = await fetch('/api/admin/rider/dispatches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rider_username: selRider, cash_php: +cashAmt.replace(/,/g, ''), notes }),
    });
    const data = await res.json();
    if (res.ok) {
      setDispatches(prev => [...prev, data]);
      setSelRider(''); setCashAmt(''); setNotes('');
      router.refresh();
    } else {
      setDispError(data.detail ?? data.error ?? 'Failed');
    }
    setDispatching(false);
  }

  async function handleReturn(d: Dispatch) {
    await fetch('/api/admin/rider/dispatch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispatch_id: d.id, action: 'return' }),
    });
    setDispatches(prev => prev.map(x => x.id === d.id ? { ...x, status: 'RETURNED', return_time: 'just now' } : x));
    if (selected?.id === d.id) setSelected(s => s ? { ...s, status: 'RETURNED' } : s);
  }

  async function handleConfirmPayment(txnId: string) {
    await fetch('/api/admin/rider/dispatch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_payment', txn_id: txnId }),
    });
    setTxns(prev => prev.map(t => t.id === txnId ? { ...t, paymentStatus: 'RECEIVED' } : t));
  }

  async function handleBorrowReturn(borrowId: string) {
    setReturning(borrowId);
    await fetch('/api/admin/rider/borrow', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrow_id: borrowId }),
    });
    setBorrows(prev => prev.map(b => b.id === borrowId ? { ...b, is_returned: 'Y' } : b));
    setReturning(null);
  }

  const inField   = dispatches.filter(d => d.status === 'IN_FIELD');
  const returned  = dispatches.filter(d => d.status === 'RETURNED');

  return (
    <div style={{ minHeight: '100vh', background: '#080a10', color: '#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid #1e2230', background: 'rgba(15,17,23,0.96)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#a78bfa,#7c5cbf)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏍️</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: '#4a5468' }}>Rider Dispatch</div>
          </div>
        </div>
        <a href="/admin" style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: '1px solid #1e2230', color: '#4a5468', textDecoration: 'none' }}>← Admin</a>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 0, minHeight: 'calc(100vh - 56px)' }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ padding: '24px 28px', borderRight: selected ? '1px solid #1e2230' : 'none' }}>
          <div style={{ ...Y, fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Today&apos;s Riders</div>

          {/* Dispatch form */}
          {undispatched.length > 0 && (
            <div style={{ background: '#0f1117', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
              <div style={{ ...M, fontSize: 10, color: '#a78bfa', letterSpacing: '0.12em', marginBottom: 14 }}>DISPATCH RIDER</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <select value={selRider} onChange={e => setSelRider(e.target.value)}
                  style={{ background: '#161922', border: '1px solid #1e2230', borderRadius: 8, padding: '10px 12px', color: selRider ? '#e2e6f0' : '#4a5468', ...M, fontSize: 13, outline: 'none' }}>
                  <option value="">Select rider…</option>
                  {undispatched.map(r => <option key={r.username} value={r.username}>{r.full_name} ({r.username})</option>)}
                </select>
                <input value={cashAmt} onChange={e => setCashAmt(fmtAmt(e.target.value))} placeholder="Starting PHP cash (e.g. 50,000)"
                  style={{ background: '#161922', border: '1px solid #1e2230', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none' }} />
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                  style={{ background: '#161922', border: '1px solid #1e2230', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none' }} />
                <button onClick={handleDispatch} disabled={dispatching || !selRider || !cashAmt}
                  style={{ padding: '12px', borderRadius: 8, border: 'none', background: (!selRider || !cashAmt) ? '#1e2230' : 'linear-gradient(135deg,#a78bfa,#7c5cbf)', color: (!selRider || !cashAmt) ? '#4a5468' : '#fff', ...Y, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                  {dispatching ? 'DISPATCHING…' : '🏍️ DISPATCH'}
                </button>
                {dispError && <div style={{ ...M, fontSize: 11, color: '#ff5c5c' }}>{dispError}</div>}
              </div>
            </div>
          )}

          {/* IN FIELD */}
          {inField.length > 0 && (
            <>
              <div style={{ ...M, fontSize: 10, color: '#a78bfa', letterSpacing: '0.12em', marginBottom: 10 }}>IN FIELD ({inField.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {inField.map(d => (
                  <div key={d.id} onClick={() => loadDetail(d)}
                    style={{ background: selected?.id === d.id ? 'rgba(167,139,250,0.08)' : '#0f1117', border: `1px solid ${selected?.id === d.id ? 'rgba(167,139,250,0.4)' : '#1e2230'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ ...Y, fontSize: 14, fontWeight: 700 }}>{d.rider_name}</span>
                        <span style={{ ...M, fontSize: 10, color: '#4a5468', marginLeft: 8 }}>{d.rider_username}</span>
                      </div>
                      <span style={{ ...M, fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(167,139,250,0.2)' }}>IN FIELD</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ ...M, fontSize: 11, color: '#4a5468' }}>Dispatched {d.dispatch_time} · {php(d.cash_php)}</span>
                      <button onClick={e => { e.stopPropagation(); handleReturn(d); }}
                        style={{ ...M, fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(0,212,170,0.3)', background: 'transparent', color: '#00d4aa', cursor: 'pointer' }}>
                        Mark Returned
                      </button>
                    </div>
                    {d.notes && <div style={{ ...M, fontSize: 10, color: '#4a5468', marginTop: 4 }}>{d.notes}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* RETURNED */}
          {returned.length > 0 && (
            <>
              <div style={{ ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.12em', marginBottom: 10 }}>RETURNED ({returned.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {returned.map(d => (
                  <div key={d.id} onClick={() => loadDetail(d)}
                    style={{ background: '#0f1117', border: '1px solid #1e2230', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', opacity: 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ ...Y, fontSize: 13, fontWeight: 700 }}>{d.rider_name}</span>
                      <span style={{ ...M, fontSize: 10, color: '#00d4aa' }}>✓ RETURNED {d.return_time}</span>
                    </div>
                    <div style={{ ...M, fontSize: 11, color: '#4a5468', marginTop: 2 }}>{php(d.cash_php)} dispatched</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {dispatches.length === 0 && (
            <div style={{ ...M, fontSize: 12, color: '#4a5468', textAlign: 'center', padding: '40px 0' }}>No riders dispatched today.</div>
          )}
        </div>

        {/* ── RIGHT PANEL (detail) ── */}
        {selected && (
          <div style={{ padding: '24px 28px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ ...Y, fontSize: 18, fontWeight: 800 }}>{selected.rider_name}</div>
                <div style={{ ...M, fontSize: 11, color: '#4a5468', marginTop: 2 }}>
                  {selected.dispatch_time} → {selected.return_time ?? 'in field'} · {php(selected.cash_php)}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ ...M, fontSize: 11, background: 'transparent', border: '1px solid #1e2230', borderRadius: 6, padding: '6px 12px', color: '#4a5468', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['txns', 'borrows'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: `1px solid ${tab === t ? '#a78bfa44' : '#1e2230'}`, background: tab === t ? 'rgba(167,139,250,0.1)' : 'transparent', color: tab === t ? '#a78bfa' : '#4a5468', cursor: 'pointer' }}>
                  {t === 'txns' ? `Transactions (${txns.length})` : `Borrows (${borrows.filter(b => b.is_returned === 'N').length} open)`}
                </button>
              ))}
            </div>

            {/* Transactions tab */}
            {tab === 'txns' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {txns.length === 0 && <div style={{ ...M, fontSize: 12, color: '#4a5468' }}>No transactions yet.</div>}
                {txns.map(t => (
                  <div key={t.id} style={{ background: '#0f1117', border: '1px solid #1e2230', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <span style={{ ...M, fontSize: 12, fontWeight: 700, color: t.type === 'BUY' ? '#5b8cff' : '#f5a623', marginRight: 8 }}>{t.type}</span>
                        <span style={{ ...M, fontSize: 12, color: '#e2e6f0' }}>{t.foreignAmt.toLocaleString()} {t.currency}</span>
                      </div>
                      <span style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>{php(t.phpAmt)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ ...M, fontSize: 10, color: '#4a5468' }}>
                        {t.paymentMode.replace('_', ' ')} · {t.time}
                        {t.customer && ` · ${t.customer}`}
                      </div>
                      {t.paymentMode !== 'CASH' && (
                        t.paymentStatus === 'PENDING' ? (
                          <button onClick={() => handleConfirmPayment(t.id)}
                            style={{ ...M, fontSize: 10, padding: '3px 10px', borderRadius: 6, border: '1px solid rgba(0,212,170,0.3)', background: 'transparent', color: '#00d4aa', cursor: 'pointer' }}>
                            ✓ Confirm Receipt
                          </button>
                        ) : (
                          <span style={{ ...M, fontSize: 10, color: '#00d4aa' }}>✓ Received</span>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Borrows tab */}
            {tab === 'borrows' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {borrows.length === 0 && <div style={{ ...M, fontSize: 12, color: '#4a5468' }}>No borrows recorded.</div>}
                {borrows.map(b => (
                  <div key={b.id} style={{ background: '#0f1117', border: `1px solid ${b.is_returned === 'Y' ? '#1e2230' : 'rgba(245,166,35,0.3)'}`, borderRadius: 10, padding: '12px 14px', opacity: b.is_returned === 'Y' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ ...M, fontSize: 12, fontWeight: 700, color: b.is_returned === 'Y' ? '#4a5468' : '#f5a623' }}>
                          {php(b.amount_php)}
                        </div>
                        <div style={{ ...M, fontSize: 10, color: '#4a5468', marginTop: 2 }}>
                          from {b.source_type === 'BRANCH' ? '🏢' : '🏍️'} {b.source_name}
                          {b.notes && ` · ${b.notes}`}
                        </div>
                      </div>
                      {b.is_returned === 'N' ? (
                        <button onClick={() => handleBorrowReturn(b.id)} disabled={returning === b.id}
                          style={{ ...M, fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(0,212,170,0.3)', background: 'transparent', color: '#00d4aa', cursor: 'pointer' }}>
                          {returning === b.id ? '…' : '✓ Returned'}
                        </button>
                      ) : (
                        <span style={{ ...M, fontSize: 10, color: '#00d4aa' }}>✓ Returned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
