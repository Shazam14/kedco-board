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
interface Topup { id: string; amount_php: number; time: string | null; dispatched_by: string | null; notes: string | null; }
interface Rider { username: string; full_name: string; }
interface Dispatch {
  id: string; rider_username: string; rider_name: string;
  status: string; dispatch_time: string | null; return_time: string | null;
  items: CurrItem[]; remit_items: CurrItem[];
  topups?: Topup[];
  cash_php?: number; remit_php?: number;
  notes: string | null; dispatched_by: string | null;
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

function InFieldCard({ d, cardStyle, onTopup }: {
  d: Dispatch;
  cardStyle: React.CSSProperties;
  onTopup: (id: string, amount: number, notes: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [open, setOpen] = useState(false);
  const amtInput = useNumberInput('', 2);
  const [topupNotes, setTopupNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const initial = (d.cash_php ?? 0) - (d.topups ?? []).reduce((s, t) => s + t.amount_php, 0);

  async function handleSubmit() {
    const amt = parseFloat(amtInput.raw);
    if (!amt || amt <= 0) return;
    setSaving(true); setErr(null);
    const r = await onTopup(d.id, amt, topupNotes);
    setSaving(false);
    if (r.ok) {
      amtInput.setValue(''); setTopupNotes(''); setOpen(false);
    } else {
      setErr(r.error);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <span style={{ ...Y, fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{d.rider_name}</span>
          <span style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginLeft: 8 }}>{d.rider_username}</span>
        </div>
        <span style={{ ...M, fontSize: 10, color: 'var(--teal-300)', background: 'rgba(61,199,173,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(61,199,173,0.2)' }}>
          IN FIELD
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>CASH</span>
        <span style={{ ...Y, fontSize: 16, fontWeight: 700, color: 'var(--accent-sky)' }}>{php(d.cash_php ?? 0)}</span>
      </div>
      {(d.topups ?? []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          <span style={{ ...M, fontSize: 10, color: 'var(--text-faint)' }}>{php(initial)} initial</span>
          {(d.topups ?? []).map(t => (
            <span key={t.id} style={{ ...M, fontSize: 10, color: 'var(--accent-gold)', background: 'rgba(245,166,35,0.06)', padding: '1px 8px', borderRadius: 10 }}>
              +{php(t.amount_php)}{t.time ? ` @ ${t.time}` : ''}
            </span>
          ))}
        </div>
      )}

      {d.items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {d.items.map((it, i) => (
            <span key={i} style={{ ...M, fontSize: 11, color: '#f5a623', background: 'rgba(245,166,35,0.08)', padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(245,166,35,0.15)' }}>
              OUT {fmt(it.amount, it.currency)}
            </span>
          ))}
        </div>
      )}

      {d.notes && <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', marginTop: 4, marginBottom: 6 }}>{d.notes}</div>}

      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ ...M, fontSize: 11, padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(95,183,212,0.3)', background: 'rgba(95,183,212,0.08)', color: 'var(--accent-sky)', cursor: 'pointer' }}>
          + TOP UP CASH
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, padding: '10px', borderRadius: 8, background: 'rgba(95,183,212,0.05)', border: '1px solid rgba(95,183,212,0.2)' }}>
          <div style={{ ...M, fontSize: 9, color: 'var(--accent-sky)', letterSpacing: '0.1em' }}>ADDITIONAL CASH (PHP)</div>
          <input
            type="text" inputMode="decimal" placeholder="0.00" autoFocus
            ref={amtInput.ref} value={amtInput.value}
            onChange={amtInput.onChange} onFocus={amtInput.onFocus}
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none' }}
          />
          <input value={topupNotes} onChange={e => setTopupNotes(e.target.value)} placeholder="Notes (optional)"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text-strong)', ...M, fontSize: 12, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSubmit} disabled={saving || !parseFloat(amtInput.raw)}
              style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: 'var(--teal-600)', color: '#fff', ...M, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '…' : 'TOP UP'}
            </button>
            <button onClick={() => { setOpen(false); amtInput.setValue(''); setTopupNotes(''); setErr(null); }}
              style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', ...M, fontSize: 11, cursor: 'pointer' }}>
              cancel
            </button>
          </div>
          {err && <div style={{ ...M, fontSize: 10, color: '#ff5c5c' }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

export default function DispatchShell({
  dispatches: initial, riders, currencies, username,
}: {
  dispatches: Dispatch[];
  riders: Rider[];
  currencies: string[];
  username: string;
}) {
  const router = useRouter();
  useIdleTimeout(20);

  const [dispatches, setDispatches] = useState<Dispatch[]>(initial);

  const [selRider, setSelRider] = useState('');
  const cashInput = useNumberInput('', 2);
  const forexCurrencies = currencies.filter(c => c !== 'PHP');
  const [forexItems, setForexItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [dispError, setDispError] = useState<string | null>(null);

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

  const cashPhp = parseFloat(cashInput.raw) || 0;
  const forexValid = forexItems.length === 0 || itemsValid(forexItems);
  const dispatchValid = !!selRider && (cashPhp > 0 || (forexItems.length > 0 && itemsValid(forexItems)));

  async function handleDispatch() {
    if (!dispatchValid) return;
    setDispatching(true); setDispError(null);
    const res = await fetch('/api/admin/rider/dispatches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rider_username: selRider,
        cash_php: cashPhp,
        items: forexItems.length > 0 ? toApi(forexItems) : [],
        notes,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setDispatches(prev => [...prev, data]);
      setSelRider(''); cashInput.setValue(''); setForexItems([]); setNotes('');
      router.refresh();
    } else {
      setDispError(data.detail ?? data.error ?? 'Failed');
    }
    setDispatching(false);
  }

  const handleTopup = useCallback(async (dispatchId: string, amount: number, topupNotes: string) => {
    const res = await fetch(`/api/admin/dispatches/${dispatchId}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_php: amount, notes: topupNotes || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setDispatches(prev => prev.map(d => d.id === dispatchId ? data : d));
      return { ok: true as const };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, error: data.detail ?? data.error ?? 'Failed' };
  }, []);

  const handleConfirmReturn = useCallback(async (dispatchId: string) => {
    setConfirming(dispatchId);
    const res = await fetch(`/api/admin/dispatches/${dispatchId}/return`, { method: 'PATCH' });
    if (res.ok) {
      const data = await res.json();
      setDispatches(prev => prev.map(d => d.id === dispatchId ? data : d));
    }
    setConfirming(null);
  }, []);

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '16px 18px',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-base)' }}>

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
              Treasurer · Rider Dispatch
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--text-strong)' }}>{username}</span>
          </div>
          <a href="/supervisor" style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, letterSpacing: '0.05em', textDecoration: 'none',
          }}>
            ← HUB
          </a>
          <a href="/admin/riders" style={{
            padding: '5px 14px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'transparent',
            color: 'var(--text-muted)', ...M, fontSize: 10, letterSpacing: '0.05em', textDecoration: 'none',
          }}>
            RIDER MGMT
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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
                <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>STARTING CASH (PHP)</div>
                <input
                  type="text" inputMode="decimal" placeholder="0.00"
                  ref={cashInput.ref} value={cashInput.value}
                  onChange={cashInput.onChange} onFocus={cashInput.onFocus}
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none' }}
                />
                {forexCurrencies.length > 0 && (
                  <>
                    <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 4 }}>
                      FOREX ITEMS (optional)
                    </div>
                    {forexItems.length === 0 ? (
                      <button
                        onClick={() => setForexItems([{ currency: forexCurrencies[0], amount: '' }])}
                        style={{ ...M, fontSize: 11, padding: '8px 0', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        + Add forex
                      </button>
                    ) : (
                      <ItemsEditor currencies={forexCurrencies} items={forexItems} onChange={setForexItems} />
                    )}
                  </>
                )}
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none' }} />
                <button onClick={handleDispatch} disabled={dispatching || !dispatchValid || !forexValid}
                  style={{
                    padding: '12px', borderRadius: 8, border: 'none',
                    background: (!dispatchValid || !forexValid) ? 'var(--border)' : 'var(--teal-600)',
                    color: (!dispatchValid || !forexValid) ? 'var(--text-muted)' : '#fff',
                    ...Y, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>
                  {dispatching ? 'DISPATCHING…' : 'DISPATCH RIDER'}
                </button>
                {dispError && <div style={{ ...M, fontSize: 11, color: '#ff5c5c' }}>{dispError}</div>}
              </div>
            </div>
          )}

          {inField.length > 0 && (
            <div>
              <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 10 }}>
                IN FIELD ({inField.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {inField.map(d => (
                  <InFieldCard key={d.id} d={d} cardStyle={cardStyle} onTopup={handleTopup} />
                ))}
              </div>
            </div>
          )}

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

          {returned.length > 0 && (() => {
            const outPhpTotal  = returned.reduce((s, d) => s + (d.cash_php  ?? 0), 0);
            const backPhpTotal = returned.reduce((s, d) => s + (d.remit_php ?? 0), 0);
            const sumByCcy = (key: 'items' | 'remit_items') => {
              const m: Record<string, number> = {};
              for (const d of returned) for (const it of d[key]) m[it.currency] = (m[it.currency] ?? 0) + it.amount;
              return m;
            };
            const outCcyTotals  = sumByCcy('items');
            const backCcyTotals = sumByCcy('remit_items');
            return (
            <div>
              <div style={{ ...M, fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.12em', marginBottom: 8 }}>
                RETURNED ({returned.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {returned.map(d => {
                  const outChip: React.CSSProperties = {
                    ...M, fontSize: 10, color: 'var(--text-muted)',
                    padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)',
                  };
                  const backChip: React.CSSProperties = {
                    ...M, fontSize: 10, color: 'var(--teal-300)',
                    background: 'rgba(61,199,173,0.06)',
                    padding: '2px 8px', borderRadius: 10, border: '1px solid rgba(61,199,173,0.2)',
                  };
                  return (
                    <div key={d.id} style={{ ...cardStyle, opacity: 0.75 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ ...Y, fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{d.rider_name}</span>
                        <span style={{ ...M, fontSize: 10, color: 'var(--teal-300)' }}>✓ RETURNED {d.return_time ?? ''}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                        <span style={outChip}>OUT {php(d.cash_php ?? 0)}</span>
                        {(d.remit_php ?? 0) > 0 && (
                          <span style={backChip}>BACK {php(d.remit_php ?? 0)}</span>
                        )}
                      </div>
                      {(d.items.length > 0 || d.remit_items.length > 0) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {d.items.map((it, i) => (
                            <span key={i} style={outChip}>OUT {fmt(it.amount, it.currency)}</span>
                          ))}
                          {d.remit_items.map((it, i) => (
                            <span key={i} style={backChip}>BACK {fmt(it.amount, it.currency)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {(() => {
                const ccySet = new Set<string>([
                  ...Object.keys(outCcyTotals),
                  ...Object.keys(backCcyTotals),
                ]);
                const fcyRows = Array.from(ccySet).sort();
                const grid: React.CSSProperties = {
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 1fr',
                  alignItems: 'center',
                  columnGap: 10,
                  padding: '6px 0',
                };
                const ccyCell: React.CSSProperties = {
                  ...M, fontSize: 11, color: 'var(--text-strong)', fontWeight: 600,
                };
                const outCell: React.CSSProperties = {
                  ...M, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right',
                };
                const backCell: React.CSSProperties = {
                  ...M, fontSize: 11, color: 'var(--teal-300)', textAlign: 'right',
                };
                const fmtAmt = (n: number) =>
                  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return (
                  <div
                    data-testid="returned-total"
                    style={{
                      ...cardStyle,
                      marginTop: 10,
                      borderColor: 'var(--teal-600)',
                      background: 'rgba(61,199,173,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ ...Y, fontSize: 12, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '0.08em' }}>
                        TOTAL · {returned.length} RETURNED
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr', columnGap: 10, ...M, fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.1em', padding: '4px 0 2px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span></span>
                      <span style={{ textAlign: 'right' }}>OUT</span>
                      <span style={{ textAlign: 'right' }}>BACK</span>
                    </div>
                    <div style={{ ...grid, borderBottom: fcyRows.length > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <span style={ccyCell}>PHP</span>
                      <span style={outCell}>{outPhpTotal > 0 ? php(outPhpTotal) : '—'}</span>
                      <span style={backCell}>{backPhpTotal > 0 ? php(backPhpTotal) : '—'}</span>
                    </div>
                    {fcyRows.map(c => (
                      <div key={c} style={grid}>
                        <span style={ccyCell}>{c}</span>
                        <span style={outCell}>{(outCcyTotals[c] ?? 0) > 0 ? fmtAmt(outCcyTotals[c]) : '—'}</span>
                        <span style={backCell}>{(backCcyTotals[c] ?? 0) > 0 ? fmtAmt(backCcyTotals[c]) : '—'}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            );
          })()}

          {dispatches.length === 0 && undispatched.length === 0 && (
            <div style={{ ...M, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>
              No riders available today.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
