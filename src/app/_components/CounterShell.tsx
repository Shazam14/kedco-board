'use client';
import { useState, useEffect, useCallback } from 'react';
import type { CurrencyMeta, Transaction } from '@/lib/types';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CounterShell({
  currencies,
  username,
}: {
  currencies: CurrencyMeta[];
  username: string;
}) {
  const [type, setType]       = useState<'BUY' | 'SELL'>('BUY');
  const [ccy,  setCcy]        = useState<CurrencyMeta | null>(null);
  const [amt,  setAmt]        = useState('');
  const [rate, setRate]       = useState('');
  const [cust, setCust]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [flash,   setFlash]   = useState<Transaction | null>(null);
  const [txns,    setTxns]    = useState<Transaction[]>([]);
  const [today,   setToday]   = useState('');

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    );
    fetchTxns();
  }, []);

  // Auto-fill rate when currency or BUY/SELL changes
  useEffect(() => {
    if (!ccy) return;
    const r = type === 'BUY' ? ccy.todayBuyRate : ccy.todaySellRate;
    setRate(r != null ? String(r) : '');
  }, [ccy, type]);

  const fetchTxns = useCallback(async () => {
    const res = await fetch('/api/counter/transactions');
    if (res.ok) setTxns(await res.json());
  }, []);

  const phpTotal =
    ccy && amt && rate && +amt > 0 && +rate > 0
      ? +amt * +rate
      : null;

  const canSubmit =
    !!ccy?.rateSet && !!amt && +amt > 0 && !!rate && +rate > 0 && !loading;

  async function handleSubmit() {
    if (!canSubmit || !ccy) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/counter/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          source: 'COUNTER',
          currency: ccy.code,
          foreign_amt: +amt,
          rate: +rate,
          cashier: username,
          customer: cust || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'Transaction failed');
      } else {
        const txn: Transaction = {
          id: data.id, time: data.time, type: data.type, source: data.source,
          currency: data.currency, foreignAmt: data.foreign_amt,
          rate: data.rate, phpAmt: data.php_amt, than: data.than,
          cashier: data.cashier, customer: data.customer ?? undefined,
        };
        setFlash(txn);
        setAmt('');
        setCust('');
        await fetchTxns();
        setTimeout(() => setFlash(null), 5000);
      }
    } finally {
      setLoading(false);
    }
  }

  function printReceipt(txn: Transaction) {
    const w = window.open('', '_blank', 'width=420,height=580');
    if (!w) return;
    const date = new Date().toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const isSell = txn.type === 'SELL';
    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt ${txn.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; background: #fff; color: #111;
         padding: 24px; font-size: 13px; line-height: 1.6; max-width: 380px; margin: 0 auto; }
  .center { text-align: center; }
  .logo { font-size: 20px; font-weight: 900; letter-spacing: 0.05em; margin-bottom: 2px; }
  .sub  { font-size: 11px; color: #555; margin-bottom: 2px; }
  .divider { border: none; border-top: 1px dashed #999; margin: 10px 0; }
  .receipt-no { font-size: 11px; color: #555; margin-top: 6px; }
  .badge { display: inline-block; border: 2px solid #111; padding: 2px 10px;
           font-size: 12px; font-weight: 900; letter-spacing: 0.15em; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td { padding: 4px 0; vertical-align: top; }
  td.label { color: #555; font-size: 11px; width: 48%; }
  td.value { font-weight: 700; text-align: right; }
  .big-php { font-size: 22px; font-weight: 900; text-align: center;
             border: 2px solid #111; padding: 8px; margin: 10px 0; }
  .footer { font-size: 10px; color: #888; text-align: center; margin-top: 14px; }
  @media print {
    body { padding: 8px; }
    @page { margin: 8mm; }
  }
</style>
<script>window.onload = () => { window.print(); }</script>
</head>
<body>
<div class="center">
  <div class="logo">KEDCO FX</div>
  <div class="sub">Pusok, Lapu-Lapu City, Cebu</div>
  <div class="sub">Foreign Exchange Services</div>
  <div class="receipt-no">${txn.id}</div>
</div>
<hr class="divider">
<div class="center"><span class="badge">${txn.type}</span></div>
<table>
  <tr><td class="label">Date</td><td class="value">${date}</td></tr>
  <tr><td class="label">Time</td><td class="value">${txn.time}</td></tr>
  <tr><td class="label">Cashier</td><td class="value">${txn.cashier}</td></tr>
  ${txn.customer ? `<tr><td class="label">Customer</td><td class="value">${txn.customer}</td></tr>` : ''}
</table>
<hr class="divider">
<table>
  <tr><td class="label">Currency</td><td class="value">${txn.currency}</td></tr>
  <tr><td class="label">Foreign Amount</td><td class="value">${txn.foreignAmt.toLocaleString()} ${txn.currency}</td></tr>
  <tr><td class="label">Rate (PHP / ${txn.currency})</td><td class="value">${txn.rate}</td></tr>
</table>
<div class="big-php">PHP ${txn.phpAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
<hr class="divider">
<div class="footer">
  ${isSell ? `<div style="margin-bottom:6px">This receipt confirms the sale of ${txn.foreignAmt.toLocaleString()} ${txn.currency} to the customer.</div>` : `<div style="margin-bottom:6px">This receipt confirms the purchase of ${txn.foreignAmt.toLocaleString()} ${txn.currency} from the customer.</div>`}
  Thank you for transacting with Kedco FX.<br>
  Please keep this receipt for your records.
</div>
</body>
</html>`);
    w.document.close();
  }

  // Running totals
  const totalBought = txns.filter(t => t.type === 'BUY').reduce((s, t) => s + t.phpAmt, 0);
  const totalSold   = txns.filter(t => t.type === 'SELL').reduce((s, t) => s + t.phpAmt, 0);
  const totalThan   = txns.reduce((s, t) => s + t.than, 0);

  const typeColor = type === 'BUY' ? '#5b8cff' : '#f5a623';
  const noRatesAtAll = currencies.every(c => !c.rateSet);
  const ratesCount   = currencies.filter(c => c.rateSet).length;

  return (
    <div style={{ minHeight: '100vh', background: '#080a10', color: '#e2e6f0' }}>

      {/* ── RATES WARNING BANNER ── */}
      {noRatesAtAll && (
        <div style={{
          background: 'rgba(245,166,35,0.1)', borderBottom: '1px solid rgba(245,166,35,0.35)',
          padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#f5a623' }}>
            No rates set for today — ask admin or supervisor to set rates before processing transactions.
          </span>
        </div>
      )}
      {!noRatesAtAll && ratesCount < currencies.length && (
        <div style={{
          background: 'rgba(245,166,35,0.06)', borderBottom: '1px solid rgba(245,166,35,0.2)',
          padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 14 }}>ℹ️</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#f5a623' }}>
            Rates set for {ratesCount} of {currencies.length} currencies today. Currencies without rates are disabled.
          </span>
        </div>
      )}

      {/* ── NAV ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '56px', borderBottom: '1px solid #1e2230',
        background: 'rgba(15,17,23,0.96)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg,#00d4aa,#00a884)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#000',
          }}>K</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e6f0', ...Y }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: '#4a5468', marginTop: -2 }}>Counter</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ ...M, fontSize: 11, color: '#4a5468' }}>
            Cashier: <span style={{ color: '#e2e6f0' }}>{username}</span>
          </div>
          <a href="/" style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #1e2230', color: '#4a5468', ...M, fontSize: 11, textDecoration: 'none' }}>
            ← Dashboard
          </a>
        </div>
      </nav>

      {/* ── BODY ── */}
      <div style={{
        padding: '28px 32px',
        display: 'grid',
        gridTemplateColumns: '400px 1fr',
        gap: 24,
        maxWidth: 1280,
      }}>

        {/* ── LEFT: FORM ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header */}
          <div>
            <div style={{ ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.2em', marginBottom: 2 }}>
              NEW TRANSACTION
            </div>
            <div style={{ ...M, fontSize: 11, color: '#4a5468' }}>{today.toUpperCase()}</div>
          </div>

          {/* BUY / SELL toggle */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
            background: '#0f1117', border: '1px solid #1e2230', borderRadius: 12, padding: 4,
          }}>
            {(['BUY', 'SELL'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '14px', border: '1px solid',
                  borderColor: type === t
                    ? (t === 'BUY' ? 'rgba(91,140,255,0.45)' : 'rgba(245,166,35,0.45)')
                    : 'transparent',
                  borderRadius: 9, cursor: 'pointer',
                  background: type === t
                    ? (t === 'BUY' ? 'rgba(91,140,255,0.14)' : 'rgba(245,166,35,0.14)')
                    : 'transparent',
                  color: type === t
                    ? (t === 'BUY' ? '#5b8cff' : '#f5a623')
                    : '#4a5468',
                  ...Y, fontSize: 15, fontWeight: 800, letterSpacing: '0.05em',
                  transition: 'all 0.15s',
                }}
              >
                {t === 'BUY' ? '↓ BUY' : '↑ SELL'}
              </button>
            ))}
          </div>

          {/* Currency */}
          <div>
            <label style={{ ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              CURRENCY
            </label>
            <select
              value={ccy?.code ?? ''}
              onChange={e => setCcy(currencies.find(c => c.code === e.target.value) ?? null)}
              style={{
                width: '100%', background: '#0f1117', border: '1px solid #1e2230',
                borderRadius: 8, padding: '12px 14px',
                color: ccy ? '#e2e6f0' : '#4a5468',
                ...M, fontSize: 13, outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">— Select currency —</option>
              {currencies.map(c => (
                <option key={c.code} value={c.code} disabled={!c.rateSet}>
                  {c.flag} {c.code} — {c.name}{!c.rateSet ? ' (no rate set)' : ''}
                </option>
              ))}
            </select>
            {ccy?.rateSet && (
              <div style={{ ...M, fontSize: 10, color: '#4a5468', marginTop: 6 }}>
                Rate board — B: <span style={{ color: '#5b8cff' }}>
                  {ccy.todayBuyRate?.toFixed(ccy.decimalPlaces)}
                </span>
                &nbsp;·&nbsp;S: <span style={{ color: '#f5a623' }}>
                  {ccy.todaySellRate?.toFixed(ccy.decimalPlaces)}
                </span>
              </div>
            )}
            {ccy && !ccy.rateSet && (
              <div style={{ ...M, fontSize: 10, color: '#ff5c5c', marginTop: 6 }}>
                No rate set for today — ask admin to set rates first.
              </div>
            )}
          </div>

          {/* Foreign Amount */}
          <div>
            <label style={{ ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              FOREIGN AMOUNT{ccy ? ` (${ccy.code})` : ''}
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={amt}
              onChange={e => setAmt(e.target.value)}
              placeholder="0.00"
              style={{
                width: '100%', background: '#0f1117', border: '1px solid #1e2230',
                borderRadius: 8, padding: '12px 14px', color: '#e2e6f0',
                ...M, fontSize: 20, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Rate */}
          <div>
            <label style={{ ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              RATE (PHP per {ccy?.code ?? 'unit'})
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={rate}
              onChange={e => setRate(e.target.value)}
              style={{
                width: '100%', background: '#0f1117', border: `1px solid ${typeColor}44`,
                borderRadius: 8, padding: '12px 14px', color: typeColor,
                ...M, fontSize: 16, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* PHP Total */}
          <div style={{
            background: '#0f1117',
            border: `1px solid ${phpTotal != null ? 'rgba(0,212,170,0.35)' : '#1e2230'}`,
            borderRadius: 12, padding: '18px 20px', transition: 'border-color 0.2s',
          }}>
            <div style={{ ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.12em', marginBottom: 8 }}>
              PHP TOTAL
            </div>
            <div style={{ ...Y, fontSize: 34, fontWeight: 800, color: phpTotal != null ? '#00d4aa' : '#4a5468' }}>
              {phpTotal != null ? php(phpTotal) : '₱ —'}
            </div>
          </div>

          {/* Customer */}
          <div>
            <label style={{ ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              CUSTOMER / REF <span style={{ opacity: 0.45 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={cust}
              onChange={e => setCust(e.target.value)}
              placeholder="Name or reference"
              style={{
                width: '100%', background: '#0f1117', border: '1px solid #1e2230',
                borderRadius: 8, padding: '12px 14px', color: '#e2e6f0',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              ...M, fontSize: 11, color: '#ff5c5c',
              background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.2)',
              borderRadius: 8, padding: '10px 14px',
            }}>
              ✗ {error}
            </div>
          )}

          {/* Success flash */}
          {flash && (
            <div style={{
              background: 'rgba(0,212,170,0.07)', border: '1px solid rgba(0,212,170,0.3)',
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ ...Y, fontSize: 12, fontWeight: 700, color: '#00d4aa' }}>
                  ✓ Saved — {flash.id}
                </div>
                <button
                  onClick={() => printReceipt(flash)}
                  style={{
                    padding: '5px 14px', borderRadius: 6,
                    border: '1px solid rgba(0,212,170,0.4)',
                    background: 'rgba(0,212,170,0.1)', color: '#00d4aa',
                    ...M, fontSize: 11, cursor: 'pointer',
                  }}
                >
                  🖨 Print Receipt
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  ['Type',     flash.type],
                  ['Currency', flash.currency],
                  ['Amount',   `${flash.foreignAmt.toLocaleString()} ${flash.currency}`],
                  ['Rate',     String(flash.rate)],
                  ['PHP',      php(flash.phpAmt)],
                  ...(flash.type === 'SELL' ? [['THAN', php(flash.than)]] : []),
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ ...M, fontSize: 9, color: '#4a5468', marginBottom: 2 }}>{k}</div>
                    <div style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '16px', borderRadius: 10, border: 'none',
              background: !canSubmit
                ? '#1e2230'
                : type === 'BUY'
                  ? 'linear-gradient(135deg,#5b8cff,#3a6fef)'
                  : 'linear-gradient(135deg,#f5a623,#e09000)',
              color: !canSubmit ? '#4a5468' : '#000',
              ...Y, fontSize: 14, fontWeight: 800,
              cursor: !canSubmit ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em', transition: 'all 0.2s',
            }}
          >
            {loading ? 'PROCESSING...' : `CONFIRM ${type} TRANSACTION`}
          </button>
        </div>

        {/* ── RIGHT: LOG ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'TOTAL BOUGHT', value: php(totalBought), color: '#5b8cff' },
              { label: 'TOTAL SOLD',   value: php(totalSold),   color: '#f5a623' },
              { label: 'TOTAL THAN',   value: php(totalThan),   color: '#00d4aa' },
            ].map(s => (
              <div key={s.label} style={{
                background: '#0f1117', border: '1px solid #1e2230',
                borderRadius: 12, padding: '16px 20px',
              }}>
                <div style={{ ...M, fontSize: 9, color: '#4a5468', letterSpacing: '0.12em', marginBottom: 8 }}>
                  {s.label}
                </div>
                <div style={{ ...Y, fontSize: 20, fontWeight: 800, color: s.color }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Transaction list */}
          <div style={{
            background: '#0f1117', border: '1px solid #1e2230',
            borderRadius: 14, overflow: 'hidden', flex: 1,
          }}>
            {/* List header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid #1e2230',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ ...M, fontSize: 10, color: '#4a5468', letterSpacing: '0.15em' }}>
                TODAY&apos;S TRANSACTIONS — {txns.length}
              </div>
              <button
                onClick={fetchTxns}
                style={{ background: 'none', border: 'none', color: '#4a5468', cursor: 'pointer', ...M, fontSize: 11 }}
              >
                ↺ refresh
              </button>
            </div>

            {txns.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', ...M, fontSize: 11, color: '#4a5468' }}>
                No transactions yet today.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                {/* Column labels */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 48px 56px 90px 80px 100px 80px 100px',
                  padding: '8px 20px', borderBottom: '1px solid #1e2230',
                  ...M, fontSize: 9, color: '#4a5468', letterSpacing: '0.1em',
                  whiteSpace: 'nowrap',
                }}>
                  <span>RECEIPT</span>
                  <span>TIME</span>
                  <span>TYPE</span>
                  <span>CCY</span>
                  <span>FOREIGN</span>
                  <span>RATE</span>
                  <span>PHP AMT</span>
                  <span>THAN</span>
                </div>

                <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                  {txns.map((t, i) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 48px 56px 90px 80px 100px 80px 100px',
                        padding: '10px 20px',
                        borderBottom: '1px solid #1e2230',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ ...M, fontSize: 10, color: '#4a5468' }}>{t.id}</span>
                      <span style={{ ...M, fontSize: 10, color: '#4a5468' }}>{t.time}</span>
                      <span style={{
                        ...M, fontSize: 11, fontWeight: 700,
                        color: t.type === 'BUY' ? '#5b8cff' : '#f5a623',
                      }}>{t.type}</span>
                      <span style={{ ...M, fontSize: 13, color: '#e2e6f0' }}>{t.currency}</span>
                      <span style={{ ...M, fontSize: 12, color: '#e2e6f0' }}>
                        {t.foreignAmt.toLocaleString()}
                      </span>
                      <span style={{
                        ...M, fontSize: 11,
                        color: t.type === 'BUY' ? '#5b8cff' : '#f5a623',
                      }}>{t.rate}</span>
                      <span style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>{php(t.phpAmt)}</span>
                      <span style={{
                        ...M, fontSize: 11,
                        color: t.than > 0 ? '#00d4aa' : '#4a5468',
                      }}>
                        {t.than > 0 ? php(t.than) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
