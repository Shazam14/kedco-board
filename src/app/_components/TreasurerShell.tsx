'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useNumberInput } from '@/hooks/useNumberInput';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';

const M: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const Y: React.CSSProperties = { fontFamily: 'var(--font-sans)' };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmt(n: number, currency: string) {
  if (currency === 'PHP') return php(n);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

interface CurrItem { currency: string; amount: number; }
interface Rider { username: string; full_name: string; }
interface Dispatch {
  id: string; rider_username: string; rider_name: string;
  status: string; dispatch_time: string | null; return_time: string | null;
  items: CurrItem[]; remit_items: CurrItem[];
  cash_php?: number; remit_php?: number;
  notes: string | null; dispatched_by: string | null;
}
interface CashierFloat {
  cashier_username: string;
  cashier_name: string;
  float_amount: number | null;
  float_id: string | null;
}

type LineItem = { currency: string; amount: string };

function itemsValid(items: LineItem[]) {
  return items.length > 0 && items.every(it => it.currency && parseFloat(it.amount) > 0);
}
function toApi(items: LineItem[]): CurrItem[] {
  return items.map(it => ({ currency: it.currency, amount: parseFloat(it.amount) }));
}

function NumberItemRow({ currencies, item, onChange, onRemove, showRemove }: {
  currencies: string[];
  item: LineItem;
  onChange: (item: LineItem) => void;
  onRemove: () => void;
  showRemove: boolean;
}) {
  const amtInput = useNumberInput(item.amount, 2);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select value={item.currency} onChange={e => onChange({ ...item, currency: e.target.value })}
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none', width: 100 }}>
        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        type="text" inputMode="decimal" placeholder="Amount"
        ref={amtInput.ref} value={amtInput.value}
        onChange={e => { amtInput.onChange(e); onChange({ ...item, amount: e.target.value.replace(/[^0-9.]/g, '') }); }}
        onFocus={amtInput.onFocus}
        style={{ flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none' }} />
      {showRemove && (
        <button onClick={onRemove}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      )}
    </div>
  );
}

function ItemsEditor({ currencies, items, onChange }: {
  currencies: string[];
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <NumberItemRow
          key={i} currencies={currencies} item={it}
          onChange={item => onChange(items.map((x, idx) => idx === i ? item : x))}
          onRemove={() => onChange(items.filter((_, idx) => idx !== i))}
          showRemove={items.length > 1}
        />
      ))}
      <button onClick={() => onChange([...items, { currency: currencies[0] ?? 'PHP', amount: '' }])}
        style={{ ...M, fontSize: 11, padding: '6px 0', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
        + Add currency
      </button>
    </div>
  );
}

function FloatRow({ cashier, onSave }: {
  cashier: CashierFloat;
  onSave: (username: string, amount: number) => Promise<void>;
}) {
  const amtInput = useNumberInput(cashier.float_amount?.toString() ?? '', 2);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const amt = parseFloat(amtInput.raw);
    if (isNaN(amt) || amt <= 0) return;
    setSaving(true);
    await onSave(cashier.cashier_username, amt);
    setSaving(false);
  }

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ ...Y, fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{cashier.cashier_name}</div>
        <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>{cashier.cashier_username}</div>
      </div>
      {cashier.float_amount !== null && (
        <div style={{ ...M, fontSize: 12, color: 'var(--teal-300)', minWidth: 80, textAlign: 'right' }}>
          {php(cashier.float_amount)}
        </div>
      )}
      <input
        type="text" inputMode="decimal" placeholder="Opening float"
        ref={amtInput.ref} value={amtInput.value}
        onChange={amtInput.onChange} onFocus={amtInput.onFocus}
        style={{ width: 140, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none' }}
      />
      <button onClick={handleSave} disabled={saving}
        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--teal-600)', color: '#fff', ...M, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {saving ? '…' : cashier.float_amount !== null ? 'Update' : 'Set Float'}
      </button>
    </div>
  );
}

export default function TreasurerShell({
  dispatches: initial, riders, currencies, cashierFloats: initialFloats, username,
}: {
  dispatches: Dispatch[];
  riders: Rider[];
  currencies: string[];
  cashierFloats: CashierFloat[];
  username: string;
}) {
  const router = useRouter();
  useIdleTimeout(20);

  const [tab, setTab] = useState<'riders' | 'cashiers'>('riders');
  const [dispatches, setDispatches] = useState<Dispatch[]>(initial);
  const [cashierFloats, setCashierFloats] = useState<CashierFloat[]>(initialFloats);

  // Dispatch form
  const [selRider, setSelRider] = useState('');
  const [dispItems, setDispItems] = useState<LineItem[]>([{ currency: currencies[0] ?? 'PHP', amount: '' }]);
  const [notes, setNotes] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispError, setDispError] = useState<string | null>(null);

  // Confirm return state
  const [confirming, setConfirming] = useState<string | null>(null);

  const undispatched = riders.filter(r =>
    !dispatches.find(d => d.rider_username === r.username && d.status === 'IN_FIELD')
  );
  const inField  = dispatches.filter(d => d.status === 'IN_FIELD');
  const remitted = dispatches.filter(d => d.status === 'REMITTED');
  const returned = dispatches.filter(d => d.status === 'RETURNED');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

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

  const handleConfirmReturn = useCallback(async (dispatchId: string) => {
    setConfirming(dispatchId);
    const res = await fetch(`/api/admin/dispatches/${dispatchId}/return`, { method: 'PATCH' });
    if (res.ok) {
      const data = await res.json();
      setDispatches(prev => prev.map(d => d.id === dispatchId ? data : d));
    }
    setConfirming(null);
  }, []);

  async function handleSetFloat(cashierUsername: string, amount: number) {
    const res = await fetch('/api/treasurer/float', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashier_username: cashierUsername, amount_php: amount }),
    });
    if (res.ok) {
      const data = await res.json();
      setCashierFloats(prev => prev.map(c =>
        c.cashier_username === cashierUsername
          ? { ...c, float_amount: data.amount_php, float_id: data.id }
          : c
      ));
    }
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '16px 18px',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-base)' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', height: '60px', borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--nav-bg)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: 'var(--text-on-teal)', fontFamily: 'var(--font-display)',
          }}>K</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
              Kedco <span style={{ color: 'var(--teal-300)' }}>FX</span>
            </div>
            <div style={{ ...M, fontSize: 9, color: 'var(--text-faint)', marginTop: -1 }}>
              Treasurer · Operations
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-strong)' }}>{username}</span>
          </div>
          <a href="/admin/riders" style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, letterSpacing: '0.05em', textDecoration: 'none',
          }}>
            RIDER MGMT
          </a>
          <a href="/supervisor/transactions" style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, letterSpacing: '0.05em', textDecoration: 'none',
          }}>
            TRANSACTIONS
          </a>
          <button onClick={handleLogout} style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
          }}>
            LOGOUT
          </button>
        </div>
      </nav>

      <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['riders', 'cashiers'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              ...M, fontSize: 11, padding: '7px 20px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${tab === t ? 'rgba(61,199,173,0.4)' : 'var(--border-subtle)'}`,
              background: tab === t ? 'rgba(61,199,173,0.1)' : 'transparent',
              color: tab === t ? 'var(--teal-300)' : 'var(--text-muted)',
              letterSpacing: '0.08em',
            }}>
              {t === 'riders' ? `RIDERS (${dispatches.length})` : `CASHIER FLOATS (${cashierFloats.length})`}
            </button>
          ))}
        </div>

        {/* ── RIDERS TAB ── */}
        {tab === 'riders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Dispatch form */}
            {undispatched.length > 0 && (
              <div style={{ ...cardStyle, border: '1px solid rgba(61,199,173,0.2)' }}>
                <div style={{ ...M, fontSize: 10, color: 'var(--teal-300)', letterSpacing: '0.12em', marginBottom: 14 }}>
                  DISPATCH RIDER
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select value={selRider} onChange={e => setSelRider(e.target.value)}
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: selRider ? 'var(--text-strong)' : 'var(--text-muted)', ...M, fontSize: 13, outline: 'none' }}>
                    <option value="">Select rider…</option>
                    {undispatched.map(r => <option key={r.username} value={r.username}>{r.full_name} ({r.username})</option>)}
                  </select>
                  <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>CASH TO DISPATCH</div>
                  <ItemsEditor currencies={currencies} items={dispItems} onChange={setDispItems} />
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none' }} />
                  <button onClick={handleDispatch} disabled={dispatching || !selRider || !itemsValid(dispItems)}
                    style={{
                      padding: '12px', borderRadius: 8, border: 'none',
                      background: (!selRider || !itemsValid(dispItems)) ? 'var(--border)' : 'var(--teal-600)',
                      color: (!selRider || !itemsValid(dispItems)) ? 'var(--text-muted)' : '#fff',
                      ...Y, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>
                    {dispatching ? 'DISPATCHING…' : 'DISPATCH RIDER'}
                  </button>
                  {dispError && <div style={{ ...M, fontSize: 11, color: '#ff5c5c' }}>{dispError}</div>}
                </div>
              </div>
            )}

            {/* IN FIELD */}
            {inField.length > 0 && (
              <div>
                <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 10 }}>
                  IN FIELD ({inField.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {inField.map(d => (
                    <div key={d.id} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <span style={{ ...Y, fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{d.rider_name}</span>
                          <span style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginLeft: 8 }}>{d.rider_username}</span>
                        </div>
                        <span style={{ ...M, fontSize: 10, color: 'var(--teal-300)', background: 'rgba(61,199,173,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(61,199,173,0.2)' }}>
                          IN FIELD
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {d.items.map((it, i) => (
                          <span key={i} style={{ ...M, fontSize: 11, color: '#f5a623', background: 'rgba(245,166,35,0.08)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(245,166,35,0.15)' }}>
                            OUT {fmt(it.amount, it.currency)}
                          </span>
                        ))}
                      </div>
                      {d.notes && <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginTop: 6 }}>{d.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REMITTED — awaiting treasurer confirmation */}
            {remitted.length > 0 && (
              <div>
                <div style={{ ...M, fontSize: 10, color: '#f5a623', letterSpacing: '0.12em', marginBottom: 10 }}>
                  AWAITING CONFIRMATION ({remitted.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {remitted.map(d => (
                    <div key={d.id} style={{ ...cardStyle, border: '1px solid rgba(245,166,35,0.25)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <span style={{ ...Y, fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{d.rider_name}</span>
                          <span style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginLeft: 8 }}>{d.rider_username}</span>
                        </div>
                        <span style={{ ...M, fontSize: 10, color: '#f5a623', background: 'rgba(245,166,35,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(245,166,35,0.2)' }}>
                          REMITTED
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {d.items.map((it, i) => (
                          <span key={i} style={{ ...M, fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>
                            OUT {fmt(it.amount, it.currency)}
                          </span>
                        ))}
                        {d.remit_items.map((it, i) => (
                          <span key={i} style={{ ...M, fontSize: 11, color: 'var(--teal-300)', background: 'rgba(61,199,173,0.08)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(61,199,173,0.2)' }}>
                            BACK {fmt(it.amount, it.currency)}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => handleConfirmReturn(d.id)}
                        disabled={confirming === d.id}
                        style={{
                          width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                          background: 'var(--teal-600)', color: '#fff',
                          ...Y, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        }}>
                        {confirming === d.id ? 'CONFIRMING…' : '✓ CONFIRM RETURN'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RETURNED */}
            {returned.length > 0 && (
              <div>
                <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.12em', marginBottom: 8 }}>
                  RETURNED ({returned.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {returned.map(d => (
                    <div key={d.id} style={{ ...cardStyle, opacity: 0.65 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ ...Y, fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{d.rider_name}</span>
                        <span style={{ ...M, fontSize: 10, color: 'var(--teal-300)' }}>✓ RETURNED {d.return_time ?? ''}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {d.items.map((it, i) => (
                          <span key={i} style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>OUT {fmt(it.amount, it.currency)}</span>
                        ))}
                        {d.remit_items.map((it, i) => (
                          <span key={i} style={{ ...M, fontSize: 10, color: 'var(--teal-300)' }}>BACK {fmt(it.amount, it.currency)}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dispatches.length === 0 && undispatched.length === 0 && (
              <div style={{ ...M, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>
                No riders available today.
              </div>
            )}
          </div>
        )}

        {/* ── CASHIER FLOATS TAB ── */}
        {tab === 'cashiers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>
              SET OPENING FLOAT PER CASHIER — cashiers will see this pre-filled when they open their shift
            </div>
            {cashierFloats.length === 0 && (
              <div style={{ ...M, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>
                No cashier accounts found.
              </div>
            )}
            {cashierFloats.map(c => (
              <FloatRow key={c.cashier_username} cashier={c} onSave={handleSetFloat} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
