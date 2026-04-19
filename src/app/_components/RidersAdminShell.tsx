'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

function fmt(n: number, currency: string) {
  if (currency === 'PHP') return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

interface Rider    { username: string; full_name: string; }
interface CurrItem { currency: string; amount: number; }
interface Dispatch {
  id: string; rider_username: string; rider_name: string;
  status: string; dispatch_time: string | null; return_time: string | null;
  items: CurrItem[]; remit_items: CurrItem[];
  notes: string | null; dispatched_by: string | null;
}
interface Borrow { id: string; source_type: string; source_name: string; amount_php: number; is_returned: string; notes: string | null; }
interface RiderTxn {
  id: string; time: string; type: string; currency: string;
  foreignAmt: number; rate: number; phpAmt: number; than: number;
  paymentMode: string; bankId: number | null; paymentStatus: string;
  customer?: string;
}

type LineItem = { currency: string; amount: string };

function ItemsEditor({ currencies, items, onChange }: {
  currencies: string[];
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}) {
  function update(i: number, field: keyof LineItem, val: string) {
    const next = items.map((it, idx) => idx === i ? { ...it, [field]: val } : it);
    onChange(next);
  }
  function add() { onChange([...items, { currency: currencies[0] ?? 'PHP', amount: '' }]); }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={it.currency} onChange={e => update(i, 'currency', e.target.value)}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', width: 100 }}>
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={it.amount} onChange={e => update(i, 'amount', e.target.value)}
            placeholder="Amount"
            style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none' }} />
          {items.length > 1 && (
            <button onClick={() => remove(i)}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
          )}
        </div>
      ))}
      <button onClick={add}
        style={{ ...M, fontSize: 11, padding: '6px 0', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
        + Add currency
      </button>
    </div>
  );
}

function itemsValid(items: LineItem[]) {
  return items.length > 0 && items.every(it => it.currency && parseFloat(it.amount) > 0);
}

function toApi(items: LineItem[]): CurrItem[] {
  return items.map(it => ({ currency: it.currency, amount: parseFloat(it.amount) }));
}

function SummaryBar({ dispatches }: { dispatches: Dispatch[] }) {
  const totals: Record<string, { out: number; back: number }> = {};

  for (const d of dispatches) {
    for (const it of d.items) {
      if (!totals[it.currency]) totals[it.currency] = { out: 0, back: 0 };
      totals[it.currency].out += it.amount;
    }
    for (const it of d.remit_items) {
      if (!totals[it.currency]) totals[it.currency] = { out: 0, back: 0 };
      totals[it.currency].back += it.amount;
    }
  }

  const entries = Object.entries(totals);
  if (entries.length === 0) return null;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <div style={{ ...M, fontSize: 10, color: '#a78bfa', letterSpacing: '0.12em', marginBottom: 10 }}>TODAY'S FLOAT SUMMARY</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {entries.map(([cur, { out, back }]) => {
          const still = out - back;
          return (
            <div key={cur} style={{ minWidth: 140 }}>
              <div style={{ ...M, fontSize: 11, color: '#a78bfa', fontWeight: 700, marginBottom: 4 }}>{cur}</div>
              <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>Out: <span style={{ color: '#f5a623' }}>{fmt(out, cur)}</span></div>
              <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>Back: <span style={{ color: '#00d4aa' }}>{fmt(back, cur)}</span></div>
              <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>Still out: <span style={{ color: still > 0 ? '#ff5c5c' : '#00d4aa' }}>{fmt(still, cur)}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RidersAdminShell({
  dispatches: initial, riders, currencies,
}: {
  dispatches: Dispatch[];
  riders: Rider[];
  currencies: string[];
}) {
  const router = useRouter();
  const [dispatches,  setDispatches]  = useState<Dispatch[]>(initial);
  const [selected,    setSelected]    = useState<Dispatch | null>(null);
  const [borrows,     setBorrows]     = useState<Borrow[]>([]);
  const [txns,        setTxns]        = useState<RiderTxn[]>([]);
  const [tab,         setTab]         = useState<'txns' | 'borrows'>('txns');

  // Dispatch form
  const [selRider,    setSelRider]    = useState('');
  const [dispItems,   setDispItems]   = useState<LineItem[]>([{ currency: currencies[0] ?? 'PHP', amount: '' }]);
  const [notes,       setNotes]       = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispError,   setDispError]   = useState<string | null>(null);

  // Remit inline form
  const [remitting,   setRemitting]   = useState<string | null>(null); // dispatch id
  const [remitItems,  setRemitItems]  = useState<LineItem[]>([{ currency: currencies[0] ?? 'PHP', amount: '' }]);
  const [remitError,  setRemitError]  = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  const [returning,   setReturning]   = useState<string | null>(null); // borrow id

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
    if (!selRider || !itemsValid(dispItems)) return;
    setDispatching(true); setDispError(null);
    const res = await fetch('/api/admin/rider/dispatches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rider_username: selRider, items: toApi(dispItems), notes }),
    });
    const data = await res.json();
    if (res.ok) {
      setDispatches(prev => [...prev, data]);
      setSelRider(''); setDispItems([{ currency: currencies[0] ?? 'PHP', amount: '' }]); setNotes('');
      router.refresh();
    } else {
      setDispError(data.detail ?? data.error ?? 'Failed');
    }
    setDispatching(false);
  }

  function openRemit(d: Dispatch) {
    setRemitting(d.id);
    // Pre-fill remit with same currencies as dispatch
    setRemitItems(d.items.length > 0
      ? d.items.map(it => ({ currency: it.currency, amount: '' }))
      : [{ currency: currencies[0] ?? 'PHP', amount: '' }]
    );
    setRemitError(null);
  }

  async function handleRemit(d: Dispatch) {
    if (!itemsValid(remitItems)) { setRemitError('Enter at least one valid amount'); return; }
    setSubmitting(true); setRemitError(null);
    const res = await fetch('/api/admin/rider/dispatch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispatch_id: d.id, action: 'return', items: toApi(remitItems) }),
    });
    const data = await res.json();
    if (res.ok) {
      setDispatches(prev => prev.map(x => x.id === d.id ? data : x));
      if (selected?.id === d.id) setSelected(data);
      setRemitting(null);
    } else {
      setRemitError(data.detail ?? data.error ?? 'Failed');
    }
    setSubmitting(false);
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

  const inField  = dispatches.filter(d => d.status === 'IN_FIELD');
  const returned = dispatches.filter(d => d.status === 'RETURNED');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#a78bfa,#7c5cbf)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏍️</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>Rider Dispatch</div>
          </div>
        </div>
        <a href="/admin" style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}>← Admin</a>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 0, minHeight: 'calc(100vh - 56px)' }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ padding: '24px 28px', borderRight: selected ? '1px solid var(--border)' : 'none' }}>
          <div style={{ ...Y, fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Today&apos;s Riders</div>

          <SummaryBar dispatches={dispatches} />

          {/* Dispatch form */}
          {undispatched.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
              <div style={{ ...M, fontSize: 10, color: '#a78bfa', letterSpacing: '0.12em', marginBottom: 14 }}>DISPATCH RIDER</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <select value={selRider} onChange={e => setSelRider(e.target.value)}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: selRider ? '#e2e6f0' : 'var(--muted)', ...M, fontSize: 13, outline: 'none' }}>
                  <option value="">Select rider…</option>
                  {undispatched.map(r => <option key={r.username} value={r.username}>{r.full_name} ({r.username})</option>)}
                </select>
                <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>CASH TO DISPATCH</div>
                <ItemsEditor currencies={currencies} items={dispItems} onChange={setDispItems} />
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none' }} />
                <button onClick={handleDispatch} disabled={dispatching || !selRider || !itemsValid(dispItems)}
                  style={{ padding: '12px', borderRadius: 8, border: 'none', background: (!selRider || !itemsValid(dispItems)) ? 'var(--border)' : 'linear-gradient(135deg,#a78bfa,#7c5cbf)', color: (!selRider || !itemsValid(dispItems)) ? 'var(--muted)' : '#fff', ...Y, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
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
                  <div key={d.id} onClick={() => { if (remitting !== d.id) loadDetail(d); }}
                    style={{ background: selected?.id === d.id ? 'rgba(167,139,250,0.08)' : 'var(--surface)', border: `1px solid ${selected?.id === d.id ? 'rgba(167,139,250,0.4)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ ...Y, fontSize: 14, fontWeight: 700 }}>{d.rider_name}</span>
                        <span style={{ ...M, fontSize: 10, color: 'var(--muted)', marginLeft: 8 }}>{d.rider_username}</span>
                      </div>
                      <span style={{ ...M, fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(167,139,250,0.2)' }}>IN FIELD</span>
                    </div>

                    {/* Dispatched items */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {d.items.map((it, i) => (
                        <span key={i} style={{ ...M, fontSize: 11, color: '#f5a623', background: 'rgba(245,166,35,0.08)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(245,166,35,0.2)' }}>
                          OUT {fmt(it.amount, it.currency)}
                        </span>
                      ))}
                    </div>

                    {d.notes && <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginBottom: 8 }}>{d.notes}</div>}

                    {/* Remit inline form */}
                    {remitting === d.id ? (
                      <div onClick={e => e.stopPropagation()} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                        <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.08em', marginBottom: 8 }}>REMIT AMOUNTS</div>
                        <ItemsEditor currencies={currencies} items={remitItems} onChange={setRemitItems} />
                        {remitError && <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginTop: 6 }}>{remitError}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button onClick={() => handleRemit(d)} disabled={submitting || !itemsValid(remitItems)}
                            style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: !itemsValid(remitItems) ? 'var(--border)' : 'linear-gradient(135deg,#00d4aa,#00a882)', color: !itemsValid(remitItems) ? 'var(--muted)' : '#fff', ...Y, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                            {submitting ? 'SAVING…' : '✓ CONFIRM REMIT'}
                          </button>
                          <button onClick={e => { e.stopPropagation(); setRemitting(null); }}
                            style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', ...M, fontSize: 12, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={e => { e.stopPropagation(); openRemit(d); }}
                          style={{ ...M, fontSize: 10, padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(0,212,170,0.3)', background: 'transparent', color: '#00d4aa', cursor: 'pointer' }}>
                          Mark Returned
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* RETURNED */}
          {returned.length > 0 && (
            <>
              <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 10 }}>RETURNED ({returned.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {returned.map(d => (
                  <div key={d.id} onClick={() => loadDetail(d)}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', cursor: 'pointer', opacity: 0.8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ ...Y, fontSize: 13, fontWeight: 700 }}>{d.rider_name}</span>
                      <span style={{ ...M, fontSize: 10, color: '#00d4aa' }}>✓ RETURNED {d.return_time}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {d.items.map((it, i) => (
                        <span key={i} style={{ ...M, fontSize: 10, color: '#f5a623' }}>OUT {fmt(it.amount, it.currency)}</span>
                      ))}
                      {d.remit_items.map((it, i) => (
                        <span key={i} style={{ ...M, fontSize: 10, color: '#00d4aa' }}>BACK {fmt(it.amount, it.currency)}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {dispatches.length === 0 && (
            <div style={{ ...M, fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>No riders dispatched today.</div>
          )}
        </div>

        {/* ── RIGHT PANEL (detail) ── */}
        {selected && (
          <div style={{ padding: '24px 28px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ ...Y, fontSize: 18, fontWeight: 800 }}>{selected.rider_name}</div>
                <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {selected.dispatch_time} → {selected.return_time ?? 'in field'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {selected.items.map((it, i) => (
                    <span key={i} style={{ ...M, fontSize: 11, color: '#f5a623' }}>OUT {fmt(it.amount, it.currency)}</span>
                  ))}
                  {selected.remit_items.map((it, i) => (
                    <span key={i} style={{ ...M, fontSize: 11, color: '#00d4aa' }}>BACK {fmt(it.amount, it.currency)}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ ...M, fontSize: 11, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--muted)', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['txns', 'borrows'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: `1px solid ${tab === t ? '#a78bfa44' : 'var(--border)'}`, background: tab === t ? 'rgba(167,139,250,0.1)' : 'transparent', color: tab === t ? '#a78bfa' : 'var(--muted)', cursor: 'pointer' }}>
                  {t === 'txns' ? `Transactions (${txns.length})` : `Borrows (${borrows.filter(b => b.is_returned === 'N').length} open)`}
                </button>
              ))}
            </div>

            {/* Transactions tab */}
            {tab === 'txns' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {txns.length === 0 && <div style={{ ...M, fontSize: 12, color: 'var(--muted)' }}>No transactions yet.</div>}
                {txns.map(t => (
                  <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <span style={{ ...M, fontSize: 12, fontWeight: 700, color: t.type === 'BUY' ? '#5b8cff' : '#f5a623', marginRight: 8 }}>{t.type}</span>
                        <span style={{ ...M, fontSize: 12, color: '#e2e6f0' }}>{t.foreignAmt.toLocaleString()} {t.currency}</span>
                      </div>
                      <span style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>₱{t.phpAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>
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
                {borrows.length === 0 && <div style={{ ...M, fontSize: 12, color: 'var(--muted)' }}>No borrows recorded.</div>}
                {borrows.map(b => (
                  <div key={b.id} style={{ background: 'var(--surface)', border: `1px solid ${b.is_returned === 'Y' ? 'var(--border)' : 'rgba(245,166,35,0.3)'}`, borderRadius: 10, padding: '12px 14px', opacity: b.is_returned === 'Y' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ ...M, fontSize: 12, fontWeight: 700, color: b.is_returned === 'Y' ? 'var(--muted)' : '#f5a623' }}>
                          ₱{b.amount_php.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
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
