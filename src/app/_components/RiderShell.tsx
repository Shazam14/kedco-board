'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrencyMeta, Transaction } from '@/lib/types';
import { useNumberInput } from '@/hooks/useNumberInput';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtFx(amt: number, code: string, currencies: { code: string; decimalPlaces: number }[]) {
  const dp = currencies.find(c => c.code === code)?.decimalPlaces ?? 2;
  return amt.toLocaleString('en-PH', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}


interface Bank     { id: number; name: string; code: string; }
interface Dispatch { id: string; cash_php: number; status: string; dispatch_time: string | null; }
interface Borrow   { id: string; amount_php: number; is_returned: string; }

const PAYMENT_MODES = [
  { value: 'CASH',          label: 'Cash',          icon: '💵' },
  { value: 'GCASH',         label: 'GCash',         icon: '📱' },
  { value: 'MAYA',          label: 'Maya',          icon: '📱' },
  { value: 'SHOPEEPAY',     label: 'ShopeePay',     icon: '📱' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: '🏦' },
  { value: 'CHEQUE',        label: 'Cheque',        icon: '📄' },
  { value: 'OTHER',         label: 'Other',         icon: '💳' },
];

const NEEDS_BANK = ['BANK_TRANSFER', 'CHEQUE'];

const BRANCHES = [
  { code: 'MAIN',  name: 'Main' },
  { code: 'CTS',   name: 'CTS' },
  { code: 'BAI',   name: 'Bai' },
  { code: 'SM',    name: 'SM' },
  { code: 'GOLD',  name: 'Gold' },
  { code: 'JMALL', name: 'Jmall' },
  { code: 'ESY2',  name: 'ESY 2' },
  { code: 'DATAG', name: 'Monekat Datag' },
  { code: 'MOBO',  name: 'Monekat Mobo' },
] as const;

export default function RiderShell({
  currencies, banks, username,
}: {
  currencies: CurrencyMeta[];
  banks: Bank[];
  username: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // ── Branch (Device Setup) ─────────────────────────────────────────────────
  const [branch,          setBranch]          = useState<string>('');
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchDraft,     setBranchDraft]     = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('kedco_branch') ?? '';
    setBranch(saved);
    if (!saved) setShowBranchModal(true);
  }, []);

  function saveBranch(val: string) {
    localStorage.setItem('kedco_branch', val);
    setBranch(val);
    setShowBranchModal(false);
  }

  const [type,        setType]        = useState<'BUY' | 'SELL'>('BUY');
  const [ccy,         setCcy]         = useState<CurrencyMeta | null>(null);
  const amtInput  = useNumberInput('', 8);
  const rateInput = useNumberInput('', 6);
  const [cust,        setCust]        = useState('');
  const [payMode,     setPayMode]     = useState('CASH');
  const [bankId,      setBankId]      = useState<number | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [flash,       setFlash]       = useState<(Transaction & { paymentLabel: string }) | null>(null);
  const [txns,        setTxns]        = useState<Transaction[]>([]);
  const [payPending,  setPayPending]  = useState(false);   // mark payment as pending/advance
  const [showPicker,  setShowPicker]  = useState(false);
  const [showLog,     setShowLog]     = useState(false);
  const [showBorrow,  setShowBorrow]  = useState(false);

  // Dispatch + borrows (for balance card)
  const [dispatch,     setDispatch]     = useState<Dispatch | null>(null);
  const [borrows,      setBorrows]      = useState<Borrow[]>([]);

  // Borrow form
  const [dispatchId,   setDispatchId]   = useState<string | null>(null);
  const [borrowSrcType,setBorrowSrcType] = useState<'BRANCH'|'RIDER'>('BRANCH');
  const [borrowSrc,    setBorrowSrc]    = useState('');
  const borrowAmtInput = useNumberInput('', 2);
  const [borrowNote,   setBorrowNote]   = useState('');
  const [borrowSaving, setBorrowSaving] = useState(false);
  const [borrowOk,     setBorrowOk]     = useState(false);

  // Auto-fill rate when currency or type changes
  useEffect(() => {
    if (!ccy) return;
    const r = type === 'BUY' ? ccy.todayBuyRate : ccy.todaySellRate;
    rateInput.setValue(r != null ? String(r) : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccy, type]);

  // Reset bank when payment mode changes away from bank/cheque
  useEffect(() => {
    if (!NEEDS_BANK.includes(payMode)) setBankId(null);
  }, [payMode]);

  const fetchTxns = useCallback(async () => {
    const res = await fetch('/api/rider/transactions');
    if (res.ok) setTxns(await res.json());
  }, []);

  useEffect(() => { fetchTxns(); }, [fetchTxns]);

  // Fetch rider's own dispatch on mount
  useEffect(() => {
    fetch('/api/rider/dispatch')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.dispatch) {
          setDispatch(d.dispatch);
          setDispatchId(d.dispatch.id);
        }
      });
  }, []);

  const fetchBorrows = useCallback(async () => {
    const res = await fetch('/api/rider/borrow');
    if (res.ok) setBorrows(await res.json());
  }, []);

  useEffect(() => { if (dispatchId) fetchBorrows(); }, [dispatchId, fetchBorrows]);

  const phpTotal = ccy && amtInput.raw && rateInput.raw && +amtInput.raw > 0 && +rateInput.raw > 0
    ? +amtInput.raw * +rateInput.raw : null;

  const canSubmit = !!ccy?.rateSet && !!amtInput.raw && +amtInput.raw > 0
    && !!rateInput.raw && +rateInput.raw > 0
    && (!NEEDS_BANK.includes(payMode) || bankId !== null)
    && !loading;

  async function handleSubmit() {
    if (!canSubmit || !ccy) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rider/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          source: 'RIDER',
          currency: ccy.code,
          foreign_amt: +amtInput.raw,
          rate: +rateInput.raw,
          cashier: username,
          customer: cust || undefined,
          payment_mode: payMode,
          bank_id: bankId ?? undefined,
          payment_status: payPending ? 'PENDING' : 'RECEIVED',
          branch_id: branch || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'Transaction failed');
      } else {
        const modeLabel = PAYMENT_MODES.find(m => m.value === payMode)?.label ?? payMode;
        const bankName  = bankId ? (banks.find(b => b.id === bankId)?.name ?? '') : '';
        setFlash({
          id: data.id, time: data.time, type: data.type, source: data.source,
          currency: data.currency, foreignAmt: data.foreign_amt,
          rate: data.rate, phpAmt: data.php_amt, than: data.than,
          cashier: data.cashier, customer: data.customer ?? undefined,
          paymentLabel: bankName ? `${modeLabel} · ${bankName}` : modeLabel,
        });
        amtInput.setValue(''); setCust(''); setPayMode('CASH'); setBankId(null); setPayPending(false);
        await fetchTxns();
        setTimeout(() => setFlash(null), 6000);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleBorrow() {
    if (!dispatchId || !borrowSrc || !borrowAmtInput.raw) return;
    setBorrowSaving(true);
    const res = await fetch('/api/rider/borrow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dispatch_id: dispatchId,
        source_type: borrowSrcType,
        source_name: borrowSrc,
        amount_php: +borrowAmtInput.raw,
        notes: borrowNote || undefined,
      }),
    });
    if (res.ok) {
      setBorrowOk(true);
      setBorrowSrc(''); borrowAmtInput.setValue(''); setBorrowNote('');
      fetchBorrows();
      setTimeout(() => { setBorrowOk(false); setShowBorrow(false); }, 2000);
    }
    setBorrowSaving(false);
  }

  const typeColor   = type === 'BUY' ? '#5b8cff' : '#f5a623';
  const todayTotal  = txns.reduce((s, t) => s + t.phpAmt, 0);
  const todayThan   = txns.filter(t => t.type === 'SELL').reduce((s, t) => s + t.than, 0);

  // Balance card calculations
  const phpSpent    = txns.filter(t => t.type === 'BUY').reduce((s, t)  => s + t.phpAmt, 0);
  const phpReceived = txns.filter(t => t.type === 'SELL').reduce((s, t) => s + t.phpAmt, 0);
  const borrowed    = borrows.filter(b => b.is_returned === 'N').reduce((s, b) => s + b.amount_php, 0);
  const remaining   = dispatch ? dispatch.cash_php + borrowed - phpSpent + phpReceived : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0', maxWidth: 480, margin: '0 auto', paddingBottom: 32 }}>

      {/* ── BRANCH SELECTOR MODAL ── */}
      {showBranchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, width: 340, maxWidth: '90vw' }}>
            <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.2em', marginBottom: 8 }}>THIS DEVICE</div>
            <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Select Branch</div>
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 28 }}>
              Which branch is this device physically located at?
            </div>
            <select
              value={branchDraft}
              onChange={e => setBranchDraft(e.target.value)}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', color: '#e2e6f0', ...M, fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
            >
              <option value="">— select branch —</option>
              {BRANCHES.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
            <button
              onClick={() => branchDraft && saveBranch(branchDraft)}
              disabled={!branchDraft}
              style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: !branchDraft ? 'var(--border)' : 'linear-gradient(135deg,#00d4aa,#00a884)', color: !branchDraft ? 'var(--muted)' : '#000', ...Y, fontSize: 14, fontWeight: 800, cursor: !branchDraft ? 'not-allowed' : 'pointer' }}
            >
              CONFIRM
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ ...Y, fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>KEDCO FX</div>
          <div style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>🏍️ {username}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setBranchDraft(branch); setShowBranchModal(true); }}
            title="Change branch"
            style={{ ...M, fontSize: 10, background: 'transparent', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, padding: '6px 10px', color: '#00d4aa', cursor: 'pointer' }}
          >
            {branch || 'SET BRANCH'}
          </button>
          <button
            onClick={() => setShowLog(v => !v)}
            style={{ ...M, fontSize: 11, background: showLog ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showLog ? '#a78bfa44' : 'var(--border)'}`, borderRadius: 8, padding: '6px 14px', color: showLog ? '#a78bfa' : 'var(--muted)', cursor: 'pointer' }}
          >
            {showLog ? '← Form' : `Log (${txns.length})`}
          </button>
          <button
            onClick={handleLogout}
            style={{ ...M, fontSize: 11, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', color: 'var(--muted)', cursor: 'pointer' }}
          >
            LOGOUT
          </button>
        </div>
      </div>

      {/* ── BALANCE CARD ── */}
      {dispatch ? (
        <div style={{ margin: '12px 16px 0', background: 'var(--surface)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ ...M, fontSize: 9, color: '#a78bfa', letterSpacing: '0.12em', marginBottom: 10 }}>PHP BALANCE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>STARTING</div>
              <div style={{ ...M, fontSize: 13, color: '#e2e6f0' }}>{php(dispatch.cash_php)}</div>
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>SPENT</div>
              <div style={{ ...M, fontSize: 13, color: phpSpent > 0 ? '#ff5c5c' : 'var(--muted)' }}>
                {phpSpent > 0 ? `−${php(phpSpent)}` : '—'}
              </div>
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>RECEIVED</div>
              <div style={{ ...M, fontSize: 13, color: phpReceived > 0 ? '#00d4aa' : 'var(--muted)' }}>
                {phpReceived > 0 ? `+${php(phpReceived)}` : '—'}
              </div>
            </div>
          </div>
          {borrowed > 0 && (
            <div style={{ ...M, fontSize: 11, color: '#f5a623', marginBottom: 8 }}>
              + {php(borrowed)} borrowed
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ ...M, fontSize: 9, color: '#a78bfa', letterSpacing: '0.1em' }}>REMAINING</div>
            <div style={{ ...Y, fontSize: 26, fontWeight: 800, color: remaining != null && remaining < 0 ? '#ff5c5c' : '#a78bfa' }}>
              {remaining != null ? php(remaining) : '—'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ margin: '12px 16px 0', background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ ...M, fontSize: 11, color: '#f5a623' }}>Not dispatched — ask admin to dispatch you before starting.</div>
        </div>
      )}

      {showLog ? (
        /* ── LOG VIEW ── */
        <div style={{ padding: '16px 16px' }}>
          <div style={{ ...Y, fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Today&apos;s Transactions</div>

          {/* Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'TOTAL PHP', val: php(todayTotal), color: '#e2e6f0' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ ...Y, fontSize: 16, fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>

          {txns.length === 0 ? (
            <div style={{ ...M, fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>No transactions yet today.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {txns.map(t => (
                <div key={t.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{t.id}</span>
                    <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>{t.time}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ ...M, fontSize: 13, fontWeight: 700, color: t.type === 'BUY' ? '#5b8cff' : '#f5a623', marginRight: 8 }}>{t.type}</span>
                      <span style={{ ...M, fontSize: 13, color: '#e2e6f0' }}>{fmtFx(t.foreignAmt, t.currency, currencies)} {t.currency}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...M, fontSize: 13, fontWeight: 700, color: '#e2e6f0' }}>{php(t.phpAmt)}</div>
                    </div>
                  </div>
                  {t.customer && <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{t.customer}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── TRANSACTION FORM ── */
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* BUY / SELL toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['BUY', 'SELL'] as const).map(t => (
              <button key={t} onClick={() => setType(t)} style={{
                padding: '16px', borderRadius: 12, border: `2px solid ${type === t ? (t === 'BUY' ? '#5b8cff' : '#f5a623') : 'var(--border)'}`,
                background: type === t ? (t === 'BUY' ? 'rgba(91,140,255,0.12)' : 'rgba(245,166,35,0.12)') : 'transparent',
                color: type === t ? (t === 'BUY' ? '#5b8cff' : '#f5a623') : 'var(--muted)',
                ...Y, fontSize: 16, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>

          {/* Currency picker */}
          <div>
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>CURRENCY</label>
            <button
              onClick={() => setShowPicker(v => !v)}
              style={{
                width: '100%', background: 'var(--surface)', border: `1px solid ${ccy ? typeColor + '44' : 'var(--border)'}`,
                borderRadius: 10, padding: '14px 16px', color: ccy ? '#e2e6f0' : 'var(--muted)',
                ...M, fontSize: 15, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>{ccy ? `${ccy.flag} ${ccy.code} — ${ccy.name}` : 'Select currency…'}</span>
              <span style={{ color: 'var(--muted)' }}>{showPicker ? '▲' : '▼'}</span>
            </button>

            {showPicker && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, maxHeight: 260, overflowY: 'auto' }}>
                {currencies.filter(c => c.rateSet).map(c => (
                  <button key={c.code} onClick={() => { setCcy(c); setShowPicker(false); }} style={{
                    width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
                    padding: '12px 16px', color: '#e2e6f0', ...M, fontSize: 13, textAlign: 'left', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>{c.flag} <strong>{c.code}</strong> — {c.name}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                      B:{c.todayBuyRate?.toFixed(c.decimalPlaces)} · S:{c.todaySellRate?.toFixed(c.decimalPlaces)}
                    </span>
                  </button>
                ))}
                {currencies.every(c => !c.rateSet) && (
                  <div style={{ ...M, fontSize: 11, color: '#f5a623', padding: '14px 16px' }}>No rates set today.</div>
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              AMOUNT {ccy ? `(${ccy.code})` : ''}
            </label>
            <input
              type="text" inputMode="decimal"
              ref={amtInput.ref}
              value={amtInput.value}
              onChange={amtInput.onChange}
              onFocus={amtInput.onFocus}
              placeholder="0.00"
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', color: '#e2e6f0', ...M, fontSize: 22, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Rate */}
          <div>
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              RATE (PHP per {ccy?.code ?? 'unit'})
            </label>
            <input
              type="text" inputMode="decimal"
              ref={rateInput.ref}
              value={rateInput.value}
              onChange={rateInput.onChange}
              onFocus={rateInput.onFocus}
              style={{ width: '100%', background: 'var(--surface)', border: `1px solid ${typeColor}44`, borderRadius: 10, padding: '16px', color: typeColor, ...M, fontSize: 18, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* PHP Total */}
          <div style={{ background: 'var(--surface)', border: `1px solid ${phpTotal != null ? 'rgba(0,212,170,0.35)' : 'var(--border)'}`, borderRadius: 12, padding: '16px' }}>
            <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>PHP TOTAL</div>
            <div style={{ ...Y, fontSize: 36, fontWeight: 800, color: phpTotal != null ? '#00d4aa' : 'var(--muted)' }}>
              {phpTotal != null ? php(phpTotal) : '₱ —'}
            </div>
          </div>

          {/* Payment mode */}
          <div>
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>PAYMENT MODE</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {PAYMENT_MODES.map(m => (
                <button key={m.value} onClick={() => setPayMode(m.value)} style={{
                  padding: '10px 4px', borderRadius: 8, border: `1px solid ${payMode === m.value ? '#a78bfa44' : 'var(--border)'}`,
                  background: payMode === m.value ? 'rgba(167,139,250,0.12)' : 'transparent',
                  color: payMode === m.value ? '#a78bfa' : 'var(--muted)',
                  ...M, fontSize: 9, cursor: 'pointer', textAlign: 'center', lineHeight: 1.4,
                }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{m.icon}</div>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bank picker — only when BANK_TRANSFER or CHEQUE */}
          {NEEDS_BANK.includes(payMode) && (
            <div>
              <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
                {payMode === 'CHEQUE' ? 'BANK (CHEQUE)' : 'BANK'}
              </label>
              <select
                value={bankId ?? ''}
                onChange={e => setBankId(e.target.value ? +e.target.value : null)}
                style={{ width: '100%', background: 'var(--surface)', border: `1px solid ${bankId ? '#a78bfa44' : '#ff5c5c44'}`, borderRadius: 10, padding: '14px 16px', color: bankId ? '#e2e6f0' : 'var(--muted)', ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="">Select bank…</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Customer */}
          <div>
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              CUSTOMER / REF <span style={{ opacity: 0.45 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={cust}
              onChange={e => setCust(e.target.value)}
              placeholder="Name or reference"
              style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', color: '#e2e6f0', ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Pending payment toggle — for non-cash modes */}
          {payMode !== 'CASH' && (
            <button onClick={() => setPayPending(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: payPending ? 'rgba(245,166,35,0.1)' : 'transparent', border: `1px solid ${payPending ? 'rgba(245,166,35,0.4)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${payPending ? '#f5a623' : 'var(--muted)'}`, background: payPending ? '#f5a623' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#000', flexShrink: 0 }}>
                {payPending ? '✓' : ''}
              </div>
              <div>
                <div style={{ ...M, fontSize: 12, color: payPending ? '#f5a623' : 'var(--muted)', fontWeight: 700 }}>Mark as Advance / Pending Payment</div>
                <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Payment not yet received — admin will confirm when collected</div>
              </div>
            </button>
          )}

          {/* Borrow cash */}
          {dispatchId && (
            <div>
              {!showBorrow ? (
                <button onClick={() => setShowBorrow(true)}
                  style={{ ...M, fontSize: 11, background: 'transparent', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 10, padding: '10px 16px', color: '#f5a623', cursor: 'pointer', width: '100%' }}>
                  💸 Record Borrowed Cash
                </button>
              ) : (
                <div style={{ background: 'var(--surface)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 12, padding: '14px' }}>
                  <div style={{ ...M, fontSize: 10, color: '#f5a623', marginBottom: 10 }}>RECORD BORROW</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    {(['BRANCH', 'RIDER'] as const).map(st => (
                      <button key={st} onClick={() => setBorrowSrcType(st)}
                        style={{ padding: '8px', borderRadius: 8, border: `1px solid ${borrowSrcType === st ? '#f5a62344' : 'var(--border)'}`, background: borrowSrcType === st ? 'rgba(245,166,35,0.1)' : 'transparent', color: borrowSrcType === st ? '#f5a623' : 'var(--muted)', ...M, fontSize: 11, cursor: 'pointer' }}>
                        {st === 'BRANCH' ? '🏢 Branch' : '🏍️ Rider'}
                      </button>
                    ))}
                  </div>
                  <input value={borrowSrc} onChange={e => setBorrowSrc(e.target.value)}
                    placeholder={borrowSrcType === 'BRANCH' ? 'Branch name' : 'Rider name'}
                    style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                  <input
                    type="text" inputMode="decimal"
                    ref={borrowAmtInput.ref}
                    value={borrowAmtInput.value}
                    onChange={borrowAmtInput.onChange}
                    onFocus={borrowAmtInput.onFocus}
                    placeholder="Amount (PHP)"
                    style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                  <input value={borrowNote} onChange={e => setBorrowNote(e.target.value)}
                    placeholder="Notes (optional)"
                    style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => setShowBorrow(false)} style={{ padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', ...M, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleBorrow} disabled={borrowSaving || !borrowSrc || !borrowAmtInput.raw}
                      style={{ padding: '10px', borderRadius: 8, border: 'none', background: (!borrowSrc || !borrowAmtInput.raw) ? 'var(--border)' : '#f5a623', color: (!borrowSrc || !borrowAmtInput.raw) ? 'var(--muted)' : '#000', ...M, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {borrowOk ? '✓ Saved!' : borrowSaving ? '…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ ...M, fontSize: 11, color: '#ff5c5c', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              {error}
            </div>
          )}

          {/* Flash confirmation */}
          {flash && (
            <div style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 12, padding: '14px' }}>
              <div style={{ ...M, fontSize: 10, color: '#00d4aa', marginBottom: 8 }}>✓ TRANSACTION SAVED</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Type',    flash.type],
                  ['Amount',  `${fmtFx(flash.foreignAmt, flash.currency, currencies)} ${flash.currency}`],
                  ['Rate',    String(flash.rate)],
                  ['PHP',     php(flash.phpAmt)],
                  ['Payment', flash.paymentLabel],
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
              padding: '20px', borderRadius: 12, border: 'none',
              background: !canSubmit ? 'var(--border)' : type === 'BUY'
                ? 'linear-gradient(135deg,#5b8cff,#3a6fef)'
                : 'linear-gradient(135deg,#f5a623,#e09000)',
              color: !canSubmit ? 'var(--muted)' : '#000',
              ...Y, fontSize: 16, fontWeight: 800, cursor: !canSubmit ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em', transition: 'all 0.2s', marginTop: 4,
            }}
          >
            {loading ? 'PROCESSING…' : `CONFIRM ${type}`}
          </button>
        </div>
      )}
    </div>
  );
}
