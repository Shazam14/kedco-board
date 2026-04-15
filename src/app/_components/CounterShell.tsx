'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrencyMeta, Transaction } from '@/lib/types';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { useNumberInput } from '@/hooks/useNumberInput';
import IDScanner, { type ScannedID } from '@/app/_components/IDScanner';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

function useWindowWidth() {
  const [w, setW] = useState(1440);
  useEffect(() => {
    setW(window.innerWidth);
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFx = (amt: number, code: string, currencies: { code: string; decimalPlaces: number }[]) => {
  const dp = currencies.find(c => c.code === code)?.decimalPlaces ?? 2;
  return amt.toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp });
};

export default function CounterShell({
  currencies,
  username,
  branchLocation,
}: {
  currencies: CurrencyMeta[];
  username: string;
  branchLocation: string;
}) {
  const router = useRouter();
  useIdleTimeout(20);

  const vw       = useWindowWidth();
  const isMobile = vw < 768;
  const isTablet = vw >= 768 && vw < 1100;
  const px       = isMobile ? 16 : isTablet ? 24 : 32;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const PAY_MODES = ['CASH', 'GCASH', 'MAYA', 'SHOPEEPAY', 'BANK TRANSFER', 'CHEQUE', 'OTHER'] as const;
  type PayMode = typeof PAY_MODES[number];

  // ── Shift state ──────────────────────────────────────────────────────────
  type Shift = {
    id: string; cashier: string; cashier_name: string; status: string;
    opened_at: string; opening_cash_php: number;
    closing_cash_php?: number; expected_cash_php?: number; cash_variance?: number;
    txn_count?: number; total_sold_php?: number; total_bought_php?: number; total_than?: number;
  };
  const [shift,         setShift]         = useState<Shift | null | undefined>(undefined); // undefined = loading
  const openingCashInput = useNumberInput('', 2);
  const closingCashInput = useNumberInput('', 2);
  const [shiftLoading,  setShiftLoading]  = useState(false);
  const [shiftError,    setShiftError]    = useState<string | null>(null);
  const [showEndModal,  setShowEndModal]  = useState(false);
  const [shiftClosed,   setShiftClosed]   = useState<Shift | null>(null);

  useEffect(() => {
    fetch('/api/counter/shift', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => setShift(data.status === 'OPEN' ? data : null))
      .catch(() => setShift(null));
  }, []);

  async function handleOpenShift() {
    const cash = parseFloat(openingCashInput.raw);
    if (isNaN(cash) || cash < 0) { setShiftError('Enter a valid opening cash amount.'); return; }
    setShiftLoading(true); setShiftError(null);
    try {
      const res = await fetch('/api/counter/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', opening_cash_php: cash }),
      });
      const data = await res.json();
      if (!res.ok) { setShiftError(data.detail ?? 'Failed to open shift.'); }
      else { setShift(data); openingCashInput.setValue(''); }
    } finally { setShiftLoading(false); }
  }

  async function handleCloseShift() {
    const cash = parseFloat(closingCashInput.raw);
    if (isNaN(cash) || cash < 0) { setShiftError('Enter actual closing cash amount.'); return; }
    setShiftLoading(true); setShiftError(null);
    try {
      const res = await fetch('/api/counter/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', closing_cash_php: cash }),
      });
      const data = await res.json();
      if (!res.ok) { setShiftError(data.detail ?? 'Failed to close shift.'); }
      else { setShiftClosed(data); setShift(null); setShowEndModal(false); closingCashInput.setValue(''); }
    } finally { setShiftLoading(false); }
  }

  // ── Transaction state ─────────────────────────────────────────────────────
  const [type,     setType]     = useState<'BUY' | 'SELL'>('BUY');
  const [ccy,      setCcy]      = useState<CurrencyMeta | null>(null);
  const amtInput  = useNumberInput('', 8);
  const rateInput = useNumberInput('', 8);
  const [cust,     setCust]     = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [scanning, setScanning] = useState(false);
  const [payMode,  setPayMode]  = useState<PayMode>('CASH');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [flash,    setFlash]    = useState<Transaction | null>(null);
  const [txns,     setTxns]     = useState<Transaction[]>([]);
  const [today,    setToday]    = useState('');

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
    rateInput.setValue(r != null ? String(r) : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccy, type]);

  const fetchTxns = useCallback(async () => {
    const res = await fetch('/api/counter/transactions');
    if (res.ok) setTxns(await res.json());
  }, []);

  const phpTotal =
    ccy && amtInput.raw && rateInput.raw && +amtInput.raw > 0 && +rateInput.raw > 0
      ? +amtInput.raw * +rateInput.raw
      : null;

  const canSubmit =
    !!ccy?.rateSet && !!amtInput.raw && +amtInput.raw > 0 && !!rateInput.raw && +rateInput.raw > 0 && !loading;

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
          foreign_amt: +amtInput.raw,
          rate: +rateInput.raw,
          cashier: username,
          customer: cust || undefined,
          id_number: idNumber || undefined,
          payment_mode: payMode,
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
          idNumber: (data.id_number ?? idNumber) || undefined,
          paymentMode: data.payment_mode ?? payMode,
        };
        setFlash(txn);
        amtInput.setValue('');
        setCust('');
        setIdNumber('');
        await fetchTxns();
        setTimeout(() => setFlash(null), 5000);
      }
    } finally {
      setLoading(false);
    }
  }

  function printReceipt(txn: Transaction) {
    const w = window.open('', '_blank', 'width=320,height=700');
    if (!w) return;

    // Date format: Apr 13 2026 (Mon) 12:42PM
    const d = new Date();
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const hh = d.getHours() % 12 || 12;
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ap = d.getHours() < 12 ? 'AM' : 'PM';
    const dateStr = `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()} (${DAYS[d.getDay()]}) ${hh}:${mm}${ap}`;

    const fmtPhp  = txn.phpAmt.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtAmt  = fmtFx(txn.foreignAmt, txn.currency, currencies);
    const fmtRate = txn.rate.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    const pm      = txn.paymentMode ?? 'CASH';

    w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>OR#${txn.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    background: #fff; color: #000;
    padding: 10px 8px;
    font-size: 12px;
    line-height: 1.65;
    width: 300px;
    margin: 0 auto;
  }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .dot    { border-top: 1px dashed #000; margin: 6px 0; }
  .row    { display: flex; justify-content: space-between; }
  .field  { margin-bottom: 1px; }
  @media print {
    body { padding: 4px 4px; }
    @page { margin: 0; size: 80mm auto; }
  }
</style>
<script>window.onload = () => window.print();</script>
</head>
<body>

<div class="center bold">Kedco Foreign Exchange Services</div>
<div class="center">${branchLocation}</div>

<div style="margin-top:6px">
  <div>${dateStr}</div>
  <div>TM#001</div>
  <div>OR#${txn.id}</div>
</div>

<div class="dot"></div>
<div class="center bold">${txn.type}</div>
<div class="dot"></div>

<table style="width:100%; border-collapse:collapse; font-size:12px;">
  <tr>
    <td style="padding:1px 0; white-space:nowrap">${txn.currency}</td>
    <td style="padding:1px 0; text-align:center; white-space:nowrap">${fmtAmt}&nbsp;x&nbsp;@&nbsp;${fmtRate}</td>
    <td style="padding:1px 0; text-align:right; white-space:nowrap">${fmtPhp}</td>
  </tr>
</table>

<div class="dot"></div>

<div class="row"><span>TOTAL</span><span>${fmtPhp}</span></div>
<div class="row"><span>${pm}</span><span>${fmtPhp}</span></div>

<div class="dot"></div>

<div class="field"># PAX &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</div>
<div class="field">CASHIER &nbsp;&nbsp;: ${txn.cashier}</div>

<div style="margin-top:8px"></div>

<div class="field">SOLD TO &nbsp;&nbsp;: ${txn.customer ?? ''}</div>
<div class="field">ADDRESS &nbsp;&nbsp;:</div>
<div class="field">ID NO &nbsp;&nbsp;&nbsp;&nbsp;: ${txn.idNumber ?? ''}</div>
<div class="field">BUSINESS STY :</div>
<div class="field">SIGNATURE &nbsp;:</div>

<div class="dot"></div>

<div class="center">Thank you.</div>
<div class="center">This is not an official receipt.</div>

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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(7,9,13,0.92)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  };
  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, padding: 32, width: '100%', maxWidth: 440,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>

      {/* ── OPEN SHIFT OVERLAY (blocks counter until shift is opened) ── */}
      {shift === null && !shiftClosed && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.2em', marginBottom: 8 }}>
              START SHIFT
            </div>
            <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              Open Your Shift
            </div>
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 28 }}>
              Count your drawer and enter the opening PHP cash before processing transactions.
            </div>

            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              OPENING CASH (PHP)
            </label>
            <input
              type="text"
              inputMode="decimal"
              ref={openingCashInput.ref}
              value={openingCashInput.value}
              onChange={openingCashInput.onChange}
              onFocus={openingCashInput.onFocus}
              placeholder="0.00"
              autoFocus
              data-testid="opening-cash-input"
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '14px 16px', color: '#e2e6f0',
                ...M, fontSize: 24, outline: 'none', boxSizing: 'border-box', marginBottom: 20,
              }}
            />

            {shiftError && (
              <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginBottom: 16 }}>✗ {shiftError}</div>
            )}

            <button
              onClick={handleOpenShift}
              disabled={shiftLoading || !openingCashInput.value}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: shiftLoading || !openingCashInput.value ? 'var(--border)' : 'linear-gradient(135deg,#00d4aa,#00a884)',
                color: shiftLoading || !openingCashInput.value ? 'var(--muted)' : '#000',
                ...Y, fontSize: 14, fontWeight: 800, cursor: shiftLoading || !openingCashInput.value ? 'not-allowed' : 'pointer',
              }}
            >
              {shiftLoading ? 'OPENING...' : 'OPEN SHIFT'}
            </button>
          </div>
        </div>
      )}

      {/* ── SHIFT CLOSED CONFIRMATION ── */}
      {shiftClosed && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.2em', marginBottom: 8 }}>
              SHIFT CLOSED
            </div>
            <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>
              Shift Summary
            </div>
            {[
              ['Transactions',    String(shiftClosed.txn_count ?? 0)],
              ['Total Sold (PHP)', php(shiftClosed.total_sold_php ?? 0)],
              ['Total Bought (PHP)', php(shiftClosed.total_bought_php ?? 0)],
              ['Total THAN',       php(shiftClosed.total_than ?? 0)],
              ['Opening Cash',     php(shiftClosed.opening_cash_php)],
              ['Expected Cash',    php(shiftClosed.expected_cash_php ?? 0)],
              ['Actual Cash',      php(shiftClosed.closing_cash_php ?? 0)],
              ['Variance',         php(shiftClosed.cash_variance ?? 0)],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{k}</span>
                <span style={{
                  ...M, fontSize: 12,
                  color: k === 'Variance'
                    ? ((shiftClosed.cash_variance ?? 0) === 0 ? '#00d4aa' : '#ff5c5c')
                    : '#e2e6f0',
                  fontWeight: k === 'Variance' ? 700 : 400,
                }}>{v}</span>
              </div>
            ))}
            <button
              onClick={handleLogout}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg,#00d4aa,#00a884)',
                color: '#000', ...Y, fontSize: 14, fontWeight: 800, cursor: 'pointer', marginTop: 24,
              }}
            >
              LOGOUT
            </button>
          </div>
        </div>
      )}

      {/* ── END SHIFT MODAL ── */}
      {showEndModal && shift && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ ...M, fontSize: 10, color: '#f5a623', letterSpacing: '0.2em', marginBottom: 4 }}>
                  END SHIFT
                </div>
                <div style={{ ...Y, fontSize: 20, fontWeight: 800 }}>Close Your Shift</div>
              </div>
              <button onClick={() => { setShowEndModal(false); setShiftError(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18 }}>
                ✕
              </button>
            </div>

            {/* Shift summary so far */}
            {[
              ['Transactions',       String(shift.txn_count ?? txns.length)],
              ['Total Sold (PHP)',   php(shift.total_sold_php ?? txns.filter(t=>t.type==='SELL').reduce((s,t)=>s+t.phpAmt,0))],
              ['Total Bought (PHP)', php(shift.total_bought_php ?? txns.filter(t=>t.type==='BUY').reduce((s,t)=>s+t.phpAmt,0))],
              ['Opening Cash',       php(shift.opening_cash_php)],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '7px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{k}</span>
                <span style={{ ...M, fontSize: 12, color: '#e2e6f0' }}>{v}</span>
              </div>
            ))}

            <div style={{ marginTop: 20 }}>
              <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
                ACTUAL CLOSING CASH (PHP) — count your drawer
              </label>
              <input
                type="text"
                inputMode="decimal"
                ref={closingCashInput.ref}
                value={closingCashInput.value}
                onChange={closingCashInput.onChange}
                onFocus={closingCashInput.onFocus}
                placeholder="0.00"
                autoFocus
                data-testid="closing-cash-input"
                style={{
                  width: '100%', background: 'var(--bg)', border: '1px solid rgba(245,166,35,0.4)',
                  borderRadius: 8, padding: '14px 16px', color: '#f5a623',
                  ...M, fontSize: 22, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {shiftError && (
              <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginTop: 12 }}>✗ {shiftError}</div>
            )}

            <button
              onClick={handleCloseShift}
              disabled={shiftLoading || !closingCashInput.value}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none', marginTop: 20,
                background: shiftLoading || !closingCashInput.value ? 'var(--border)' : 'linear-gradient(135deg,#f5a623,#e09000)',
                color: shiftLoading || !closingCashInput.value ? 'var(--muted)' : '#000',
                ...Y, fontSize: 14, fontWeight: 800, cursor: shiftLoading || !closingCashInput.value ? 'not-allowed' : 'pointer',
              }}
            >
              {shiftLoading ? 'CLOSING...' : 'CLOSE SHIFT'}
            </button>
          </div>
        </div>
      )}

      {scanning && (
        <IDScanner
          onScan={(result: ScannedID) => {
            setCust(result.name);
            if (result.idNumber) setIdNumber(result.idNumber);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {/* ── RATES WARNING BANNER ── */}
      {noRatesAtAll && (
        <div style={{
          background: 'rgba(245,166,35,0.1)', borderBottom: '1px solid rgba(245,166,35,0.35)',
          padding: `12px ${px}px`, display: 'flex', alignItems: 'center', gap: 12,
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
          padding: `10px ${px}px`, display: 'flex', alignItems: 'center', gap: 12,
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
        padding: `0 ${px}px`, height: '56px', borderBottom: '1px solid var(--border)',
        background: 'var(--nav-bg)', backdropFilter: 'blur(12px)',
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
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: -2 }}>Counter</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ color: '#e2e6f0' }}>{username}</span>
          </div>
          {shift && (
            <button
              onClick={() => { setShiftError(null); setShowEndModal(true); }}
              style={{
                padding: '5px 14px', borderRadius: 6,
                border: '1px solid rgba(245,166,35,0.4)',
                background: 'rgba(245,166,35,0.08)',
                color: '#f5a623', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
              }}
            >
              END SHIFT
            </button>
          )}
          <button onClick={handleLogout} style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em' }}>
            LOGOUT
          </button>
        </div>
      </nav>

      {/* ── BODY ── */}
      <div style={{
        padding: `24px ${px}px`,
        display: 'grid',
        gridTemplateColumns: isMobile || isTablet ? '1fr' : '400px 1fr',
        gap: 24,
        maxWidth: 1280,
      }}>

        {/* ── LEFT: FORM ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header */}
          <div>
            <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 2 }}>
              NEW TRANSACTION
            </div>
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{today.toUpperCase()}</div>
          </div>

          {/* BUY / SELL toggle */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4,
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
                    : 'var(--muted)',
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
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              CURRENCY
            </label>
            <select
              value={ccy?.code ?? ''}
              onChange={e => setCcy(currencies.find(c => c.code === e.target.value) ?? null)}
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px',
                color: ccy ? '#e2e6f0' : 'var(--muted)',
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
              <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
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
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              FOREIGN AMOUNT{ccy ? ` (${ccy.code})` : ''}
            </label>
            <input
              type="text"
              inputMode="decimal"
              ref={amtInput.ref}
              value={amtInput.value}
              onChange={amtInput.onChange}
              onFocus={amtInput.onFocus}
              placeholder="0.00"
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px', color: '#e2e6f0',
                ...M, fontSize: 20, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Rate */}
          <div>
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              RATE (PHP per {ccy?.code ?? 'unit'})
            </label>
            <input
              type="text"
              inputMode="decimal"
              ref={rateInput.ref}
              value={rateInput.value}
              onChange={rateInput.onChange}
              onFocus={rateInput.onFocus}
              style={{
                width: '100%', background: 'var(--surface)', border: `1px solid ${typeColor}44`,
                borderRadius: 8, padding: '12px 14px', color: typeColor,
                ...M, fontSize: 16, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* PHP Total */}
          <div style={{
            background: 'var(--surface)',
            border: `1px solid ${phpTotal != null ? 'rgba(0,212,170,0.35)' : 'var(--border)'}`,
            borderRadius: 12, padding: '18px 20px', transition: 'border-color 0.2s',
          }}>
            <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 8 }}>
              PHP TOTAL
            </div>
            <div style={{ ...Y, fontSize: 34, fontWeight: 800, color: phpTotal != null ? '#00d4aa' : 'var(--muted)' }}>
              {phpTotal != null ? php(phpTotal) : '₱ —'}
            </div>
          </div>

          {/* Customer / AMLA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em' }}>
                CUSTOMER / AMLA <span style={{ opacity: 0.45 }}>(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setScanning(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6,
                  border: '1px solid rgba(0,212,170,0.4)',
                  background: 'rgba(0,212,170,0.07)',
                  color: '#00d4aa', ...M, fontSize: 10, cursor: 'pointer',
                }}
              >
                📷 Scan ID
              </button>
            </div>
            <input
              type="text"
              value={cust}
              onChange={e => setCust(e.target.value)}
              placeholder="Name or reference"
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px', color: '#e2e6f0',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
            <input
              type="text"
              value={idNumber}
              onChange={e => setIdNumber(e.target.value)}
              placeholder="ID number (PhilSys / DL / Passport)"
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: '#e2e6f0',
                ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Payment Mode */}
          <div>
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              PAYMENT MODE
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PAY_MODES.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayMode(m)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${payMode === m ? 'rgba(0,212,170,0.5)' : 'var(--border)'}`,
                    background: payMode === m ? 'rgba(0,212,170,0.1)' : 'transparent',
                    color: payMode === m ? '#00d4aa' : 'var(--muted)',
                    ...M, fontSize: 10, letterSpacing: '0.05em',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
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
                  ['Amount',   `${fmtFx(flash.foreignAmt, flash.currency, currencies)} ${flash.currency}`],
                  ['Rate',     String(flash.rate)],
                  ['PHP',      php(flash.phpAmt)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>{k}</div>
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
                ? 'var(--border)'
                : type === 'BUY'
                  ? 'linear-gradient(135deg,#5b8cff,#3a6fef)'
                  : 'linear-gradient(135deg,#f5a623,#e09000)',
              color: !canSubmit ? 'var(--muted)' : '#000',
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
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 12 }}>
            {[
              { label: 'TOTAL BOUGHT', value: php(totalBought), color: '#5b8cff' },
              { label: 'TOTAL SOLD',   value: php(totalSold),   color: '#f5a623' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 20px',
              }}>
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 8 }}>
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
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden', flex: 1,
          }}>
            {/* List header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em' }}>
                TODAY&apos;S TRANSACTIONS — {txns.length}
              </div>
              <button
                onClick={fetchTxns}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', ...M, fontSize: 11 }}
              >
                ↺ refresh
              </button>
            </div>

            {txns.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', ...M, fontSize: 11, color: 'var(--muted)' }}>
                No transactions yet today.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                {/* Column labels */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 48px 56px 90px 80px 100px 80px',
                  padding: '8px 20px', borderBottom: '1px solid var(--border)',
                  ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
                  whiteSpace: 'nowrap',
                }}>
                  <span>RECEIPT</span>
                  <span>TIME</span>
                  <span>TYPE</span>
                  <span>CCY</span>
                  <span>FOREIGN</span>
                  <span>RATE</span>
                  <span>PHP AMT</span>
                </div>

                <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                  {txns.map((t, i) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 48px 56px 90px 80px 100px 80px',
                        padding: '10px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{t.id}</span>
                      <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{t.time}</span>
                      <span style={{
                        ...M, fontSize: 11, fontWeight: 700,
                        color: t.type === 'BUY' ? '#5b8cff' : '#f5a623',
                      }}>{t.type}</span>
                      <span style={{ ...M, fontSize: 13, color: '#e2e6f0' }}>{t.currency}</span>
                      <span style={{ ...M, fontSize: 12, color: '#e2e6f0' }}>
                        {fmtFx(t.foreignAmt, t.currency, currencies)}
                      </span>
                      <span style={{
                        ...M, fontSize: 11,
                        color: t.type === 'BUY' ? '#5b8cff' : '#f5a623',
                      }}>{t.rate}</span>
                      <span style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>{php(t.phpAmt)}</span>
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
