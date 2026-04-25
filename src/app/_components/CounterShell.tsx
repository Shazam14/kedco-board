'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrencyMeta, Transaction } from '@/lib/types';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { useNumberInput } from '@/hooks/useNumberInput';
import IDScanner, { type ScannedID } from '@/app/_components/IDScanner';
import ExpensePanel from '@/app/_components/ExpensePanel';

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
  banks,
  username,
  role = 'cashier',
  branchLocation,
}: {
  currencies: CurrencyMeta[];
  banks: { id: number; name: string; code: string }[];
  username: string;
  role?: string;
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

  const PAY_MODES = ['CASH', 'GCASH', 'MAYA', 'SHOPEEPAY', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const;
  type PayMode = typeof PAY_MODES[number];
  const NEEDS_BANK: readonly PayMode[] = ['BANK_TRANSFER', 'CHEQUE'];

  // ── Shift state ──────────────────────────────────────────────────────────
  type Replenishment = { id: string; amount_php: number; note?: string; added_at: string };
  type Shift = {
    id: string; cashier: string; cashier_name: string; status: string;
    opened_at: string; opening_cash_php: number;
    closing_cash_php?: number; expected_cash_php?: number; cash_variance?: number;
    txn_count?: number; total_sold_php?: number; total_bought_php?: number; total_than?: number;
    total_commission?: number; total_replenishment_php?: number;
    replenishments?: Replenishment[];
  };
  const [shift,         setShift]         = useState<Shift | null | undefined>(undefined); // undefined = loading
  const openingCashInput = useNumberInput('', 2);
  const closingCashInput = useNumberInput('', 2);
  const [shiftLoading,       setShiftLoading]       = useState(false);
  const [shiftError,         setShiftError]         = useState<string | null>(null);
  const [showEndModal,       setShowEndModal]       = useState(false);
  const [showReplenishModal, setShowReplenishModal] = useState(false);
  const [shiftClosed,        setShiftClosed]        = useState<Shift | null>(null);
  const replenishInput = useNumberInput('', 2);
  const [replenishNote,      setReplenishNote]      = useState('');
  const [replenishLoading,   setReplenishLoading]   = useState(false);
  const [replenishError,     setReplenishError]     = useState<string | null>(null);

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

  async function handleReplenish() {
    const amount = parseFloat(replenishInput.raw);
    if (isNaN(amount) || amount <= 0) { setReplenishError('Enter a valid amount.'); return; }
    setReplenishLoading(true); setReplenishError(null);
    try {
      const res = await fetch('/api/counter/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replenish', amount_php: amount, note: replenishNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setReplenishError(data.detail ?? 'Failed to record replenishment.'); }
      else { setShift(data); setShowReplenishModal(false); replenishInput.setValue(''); setReplenishNote(''); }
    } finally { setReplenishLoading(false); }
  }

  // ── Transaction state ─────────────────────────────────────────────────────
  const [type,     setType]     = useState<'BUY' | 'SELL'>('BUY');
  const [ccy,      setCcy]      = useState<CurrencyMeta | null>(null);
  const [ccyQuery, setCcyQuery] = useState('');
  const [ccyOpen,  setCcyOpen]  = useState(false);
  const amtInput       = useNumberInput('', 8);
  const rateInput      = useNumberInput('', 8);
  const guideRateInput = useNumberInput('', 8);
  const [cust,     setCust]     = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [scanning, setScanning] = useState(false);
  const [referrer,       setReferrer]       = useState('');
  const [paymentTag,     setPaymentTag]     = useState<'ADVANCE' | 'LATE' | ''>('');
  const [referenceDate,  setReferenceDate]  = useState('');
  const [payMode,        setPayMode]        = useState<PayMode>('CASH');
  const [bankId,   setBankId]   = useState<number | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [flash,       setFlash]       = useState<Transaction | null>(null);
  const [batchFlash,  setBatchFlash]  = useState<Transaction[] | null>(null);
  type CartItem = { ccy: CurrencyMeta; foreign_amt: number; rate: number; official_rate?: number };
  const [cart, setCart] = useState<CartItem[]>([]);
  const [txns,     setTxns]     = useState<Transaction[]>([]);
  const [today,    setToday]    = useState('');

  useEffect(() => {
    const now = new Date();
    setToday(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    setReferenceDate(now.toISOString().split('T')[0]);
    fetchTxns();
  }, []);

  // Reset bank selection when switching away from bank-requiring modes
  useEffect(() => {
    if (!NEEDS_BANK.includes(payMode)) setBankId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMode]);

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
    !!ccy && !!amtInput.raw && +amtInput.raw > 0 && !!rateInput.raw && +rateInput.raw > 0 && !loading
    && (!NEEDS_BANK.includes(payMode) || bankId !== null);

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
          bank_id: bankId ?? undefined,
          official_rate: +guideRateInput.raw > 0 ? +guideRateInput.raw : undefined,
          referrer: referrer || undefined,
          payment_tag: paymentTag || undefined,
          reference_date: (role === 'supervisor' && referenceDate) ? referenceDate : undefined,
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
          officialRate: data.official_rate ?? undefined,
          referrer: data.referrer ?? undefined,
          paymentTag: data.payment_tag ?? undefined,
          referenceDate: data.reference_date ?? undefined,
        };
        setFlash(txn);
        amtInput.setValue('');
        setCust('');
        setIdNumber('');
        setReferrer('');
        guideRateInput.setValue('');
        setPaymentTag('');
        setReferenceDate(new Date().toISOString().split('T')[0]);
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
${txn.referrer ? `<div class="field">REFERRER &nbsp;&nbsp;: ${txn.referrer}</div>` : ''}

<div class="dot"></div>

<div class="center">Thank you.</div>
<div class="center">This is not an official receipt.</div>

</body>
</html>`);
    w.document.close();
  }

  function addToCart() {
    if (!ccy || !+amtInput.raw || !+rateInput.raw) return;
    setCart(prev => [...prev, {
      ccy,
      foreign_amt: +amtInput.raw,
      rate: +rateInput.raw,
      official_rate: +guideRateInput.raw > 0 ? +guideRateInput.raw : undefined,
    }]);
    setCcy(null); setCcyQuery(''); amtInput.setValue(''); rateInput.setValue(''); guideRateInput.setValue('');
  }

  async function handleBatchSubmit() {
    if (cart.length === 0) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/counter/transactions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          source: 'COUNTER',
          customer: cust || undefined,
          payment_mode: payMode,
          bank_id: bankId ?? undefined,
          referrer: referrer || undefined,
          items: cart.map(item => ({
            currency: item.ccy.code,
            foreign_amt: item.foreign_amt,
            rate: item.rate,
            official_rate: item.official_rate,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? 'Batch transaction failed');
      } else {
        const mapped: Transaction[] = data.map((t: Record<string, unknown>) => ({
          id: t.id, time: t.time, type: t.type, source: t.source,
          currency: t.currency, foreignAmt: t.foreign_amt,
          rate: t.rate, phpAmt: t.php_amt, than: t.than,
          cashier: t.cashier, customer: t.customer ?? undefined,
          paymentMode: t.payment_mode ?? payMode,
          officialRate: t.official_rate ?? undefined,
          referrer: t.referrer ?? undefined,
        }));
        setCart([]);
        setBatchFlash(mapped);
        setCcy(null); setCcyQuery(''); amtInput.setValue(''); rateInput.setValue('');
        setCust(''); setIdNumber(''); setReferrer('');
        guideRateInput.setValue(''); setPaymentTag('');
        await fetchTxns();
        setTimeout(() => setBatchFlash(null), 8000);
      }
    } finally {
      setLoading(false);
    }
  }

  function printBatchReceipt(txns: Transaction[]) {
    if (txns.length === 0) return;
    const w = window.open('', '_blank', 'width=320,height=700');
    if (!w) return;
    const d = new Date();
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const hh = d.getHours() % 12 || 12;
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ap = d.getHours() < 12 ? 'AM' : 'PM';
    const dateStr = `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()} (${DAYS[d.getDay()]}) ${hh}:${mm}${ap}`;
    const totalPhp = txns.reduce((s, t) => s + t.phpAmt, 0);
    const fmtPhpTotal = totalPhp.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pm = txns[0].paymentMode ?? 'CASH';
    const rows = txns.map(t => {
      const fmtAmt  = fmtFx(t.foreignAmt, t.currency, currencies);
      const fmtRate = t.rate.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
      const fmtPhp  = t.phpAmt.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `<tr>
        <td style="padding:1px 0;white-space:nowrap">${t.currency}</td>
        <td style="padding:1px 0;text-align:center;white-space:nowrap">${fmtAmt}&nbsp;x&nbsp;@&nbsp;${fmtRate}</td>
        <td style="padding:1px 0;text-align:right;white-space:nowrap">${fmtPhp}</td>
      </tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>OR#${txns[0].id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Courier New',Courier,monospace;background:#fff;color:#000;padding:10px 8px;font-size:12px;line-height:1.65;width:300px;margin:0 auto}
  .center{text-align:center}.bold{font-weight:bold}.dot{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between}.field{margin-bottom:1px}
  @media print{body{padding:4px}@page{margin:0;size:80mm auto}}
</style>
<script>window.onload=()=>window.print();</script>
</head><body>
<div class="center bold">Kedco Foreign Exchange Services</div>
<div class="center">${branchLocation}</div>
<div style="margin-top:6px"><div>${dateStr}</div><div>TM#001</div><div>OR#${txns[0].id}</div></div>
<div class="dot"></div><div class="center bold">${txns[0].type}</div><div class="dot"></div>
<table style="width:100%;border-collapse:collapse;font-size:12px;">${rows}</table>
<div class="dot"></div>
<div class="row"><span>TOTAL</span><span>&#8369;${fmtPhpTotal}</span></div>
<div class="row"><span>${pm}</span><span>&#8369;${fmtPhpTotal}</span></div>
<div class="dot"></div>
<div class="field"># PAX &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</div>
<div class="field">CASHIER &nbsp;&nbsp;: ${txns[0].cashier}</div>
<div style="margin-top:8px"></div>
<div class="field">SOLD TO &nbsp;&nbsp;: ${txns[0].customer ?? ''}</div>
<div class="field">ADDRESS &nbsp;&nbsp;:</div>
<div class="field">ID NO &nbsp;&nbsp;&nbsp;&nbsp;:</div>
<div class="field">BUSINESS STY :</div>
<div class="field">SIGNATURE &nbsp;:</div>
${txns[0].referrer ? `<div class="field">REFERRER &nbsp;&nbsp;: ${txns[0].referrer}</div>` : ''}
<div class="dot"></div>
<div class="center">Thank you.</div>
<div class="center">This is not an official receipt.</div>
</body></html>`);
    w.document.close();
  }

  // ── Edit request state ───────────────────────────────────────────────────
  type EditDraft = { type: 'BUY' | 'SELL'; customer: string; payment_mode: string; rate: string; foreign_amt: string; official_rate: string; note: string; referrer: string };
  const [editTxn,     setEditTxn]     = useState<Transaction | null>(null);
  const [editDraft,   setEditDraft]   = useState<EditDraft | null>(null);
  const [editBankId,  setEditBankId]  = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState<string | null>(null);
  const [editSent,    setEditSent]    = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Set<string>>(new Set());

  // Restore pending badges on mount
  useEffect(() => {
    fetch('/api/counter/edit-requests')
      .then(r => r.ok ? r.json() : [])
      .then((ids: string[]) => setPendingEdits(new Set(ids)))
      .catch(() => {});
  }, []);

  function openEdit(t: Transaction) {
    setEditTxn(t);
    setEditDraft({
      type:          t.type as 'BUY' | 'SELL',
      customer:      t.customer ?? '',
      payment_mode:  t.paymentMode ?? 'CASH',
      rate:          String(t.rate),
      foreign_amt:   String(t.foreignAmt),
      official_rate: t.officialRate != null ? String(t.officialRate) : '',
      note:          '',
      referrer:      t.referrer ?? '',
    });
    setEditBankId(t.bankId ?? null);
    setEditError(null);
    setEditSent(false);
  }

  function buildEditBody(draft: EditDraft, txn: Transaction, bankId: number | null): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (draft.type         !== txn.type)                    body.type         = draft.type;
    if (draft.customer     !== (txn.customer ?? ''))        body.customer     = draft.customer || null;
    if (draft.payment_mode !== (txn.paymentMode ?? 'CASH')) body.payment_mode = draft.payment_mode;
    if (bankId !== (txn.bankId ?? null))                    body.bank_id      = bankId;
    if (draft.referrer     !== (txn.referrer ?? ''))        body.referrer     = draft.referrer || null;
    const newRate    = parseFloat(draft.rate);
    const newAmt     = parseFloat(draft.foreign_amt);
    const newOffRate = parseFloat(draft.official_rate);
    if (!isNaN(newRate) && newRate !== txn.rate)       body.rate        = newRate;
    if (!isNaN(newAmt)  && newAmt  !== txn.foreignAmt) body.foreign_amt = newAmt;
    const wantsClear = draft.official_rate === '' || (!isNaN(newOffRate) && newOffRate === 0);
    if (wantsClear && txn.officialRate)                body.official_rate = 0;
    else if (!wantsClear && !isNaN(newOffRate) && newOffRate !== (txn.officialRate ?? null)) body.official_rate = newOffRate;
    return body;
  }

  async function handleEditRequest() {
    if (!editTxn || !editDraft) return;
    const body = buildEditBody(editDraft, editTxn, editBankId);
    if (editDraft.note.trim()) body.note = editDraft.note.trim();
    if (Object.keys(body).filter(k => k !== 'note').length === 0) {
      setEditError('No changes detected.'); return;
    }
    setEditLoading(true); setEditError(null);
    try {
      const res = await fetch(`/api/counter/transactions/${editTxn.id}/edit-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.detail ?? 'Failed to submit request'); return; }
      setPendingEdits(prev => new Set([...prev, editTxn.id]));
      setEditSent(true);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleAdminEdit() {
    if (!editTxn || !editDraft) return;
    const body = buildEditBody(editDraft, editTxn, editBankId);
    if (Object.keys(body).length === 0) {
      setEditError('No changes detected.'); return;
    }
    setEditLoading(true); setEditError(null);
    try {
      const res = await fetch(`/api/counter/transactions/${editTxn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.detail ?? 'Failed to save'); return; }
      setEditTxn(null); setEditDraft(null);
      await fetchTxns();
    } finally {
      setEditLoading(false);
    }
  }

  // Running totals
  const totalBought     = txns.filter(t => t.type === 'BUY').reduce((s, t) => s + t.phpAmt, 0);
  const totalSold       = txns.filter(t => t.type === 'SELL').reduce((s, t) => s + t.phpAmt, 0);
  const totalThan       = txns.reduce((s, t) => s + t.than, 0);
  const totalCommission = txns.reduce((s, t) => {
    if (!t.officialRate) return s;
    const c = t.type === 'SELL'
      ? (t.rate - t.officialRate) * t.foreignAmt
      : (t.officialRate - t.rate) * t.foreignAmt;
    return s + c;
  }, 0);

  function printShift(s: Shift) {
    const phpFmt = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dateLabel = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
    const comm = s.total_commission ?? 0;
    const repl = s.total_replenishment_php ?? 0;
    const variance = s.cash_variance ?? 0;

    // Per-currency breakdown from local txns
    const byCcy: Record<string, { buyQty: number; buyPhp: number; sellQty: number; sellPhp: number }> = {};
    for (const t of txns) {
      if (!byCcy[t.currency]) byCcy[t.currency] = { buyQty: 0, buyPhp: 0, sellQty: 0, sellPhp: 0 };
      if (t.type === 'BUY') { byCcy[t.currency].buyQty += t.foreignAmt; byCcy[t.currency].buyPhp += t.phpAmt; }
      else                  { byCcy[t.currency].sellQty += t.foreignAmt; byCcy[t.currency].sellPhp += t.phpAmt; }
    }
    const ccyEntries = Object.entries(byCcy);
    const dp = (code: string) => currencies.find(c => c.code === code)?.decimalPlaces ?? 2;
    const fmtQ = (amt: number, code: string) => amt.toLocaleString('en-PH', { minimumFractionDigits: dp(code), maximumFractionDigits: dp(code) });

    const th = (label: string, align = 'left') =>
      `<th style="padding:6px 8px;background:#222;color:#fff;text-align:${align};font-size:10px;letter-spacing:0.08em">${label}</th>`;

    const ccyTable = ccyEntries.length === 0 ? '' : `
      <h2>CURRENCY BREAKDOWN</h2>
      <table>
        <thead><tr>${th('CCY')}${th('BUY QTY','right')}${th('BUY PHP','right')}${th('SELL QTY','right')}${th('SELL PHP','right')}</tr></thead>
        <tbody>
          ${ccyEntries.map(([code, d], i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
              <td style="padding:7px 8px;font-weight:700">${code}</td>
              <td style="text-align:right;color:#2255cc">${d.buyQty > 0 ? fmtQ(d.buyQty, code) : '—'}</td>
              <td style="text-align:right;color:#2255cc;font-weight:600">${d.buyPhp > 0 ? phpFmt(d.buyPhp) : '—'}</td>
              <td style="text-align:right;color:#c47000">${d.sellQty > 0 ? fmtQ(d.sellQty, code) : '—'}</td>
              <td style="text-align:right;color:#c47000;font-weight:600">${d.sellPhp > 0 ? phpFmt(d.sellPhp) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Kedco FX — Shift Report — ${s.cashier}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: #fff; padding: 24px; }
        h1 { font-family: Arial, sans-serif; font-size: 18px; font-weight: 900; }
        h2 { font-family: Arial, sans-serif; font-size: 13px; font-weight: 800; margin: 20px 0 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
        td { padding: 7px 8px; border-bottom: 1px solid #e0e0e0; }
        .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #e0e0e0; }
        .label { color: #555; }
        .val { font-weight: 600; }
        .highlight { background: #fff8e1; padding: 10px 14px; border-radius: 6px; border: 1px solid #f5c842; display: flex; justify-content: space-between; margin: 12px 0; }
        @media print { body { padding: 12px; } }
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #000">
        <h1>KEDCO FX — SHIFT REPORT</h1>
        <div style="font-size:12px;color:#555;margin-top:4px">${dateLabel}</div>
        <div style="font-size:11px;color:#888;margin-top:2px">${s.cashier_name} (@${s.cashier})</div>
      </div>

      <div class="row"><span class="label">Transactions</span><span class="val">${s.txn_count ?? txns.length}</span></div>
      <div class="row"><span class="label">Total Sold (PHP)</span><span class="val" style="color:#c47000">${phpFmt(s.total_sold_php ?? 0)}</span></div>
      <div class="row"><span class="label">Total Bought (PHP)</span><span class="val" style="color:#2255cc">${phpFmt(s.total_bought_php ?? 0)}</span></div>
      <div class="row"><span class="label">Total THAN</span><span class="val" style="color:#007a55">${phpFmt(s.total_than ?? 0)}</span></div>
      ${comm !== 0 ? `<div class="row"><span class="label">Commission</span><span class="val" style="color:#cc0000">${comm > 0 ? '-' : '+'}${phpFmt(Math.abs(comm))}</span></div>` : ''}
      ${repl !== 0 ? `<div class="row"><span class="label">Replenishment</span><span class="val" style="color:#007a55">+${phpFmt(repl)}</span></div>` : ''}
      <div class="row"><span class="label">Opening Cash</span><span class="val">${phpFmt(s.opening_cash_php)}</span></div>
      <div class="highlight">
        <span style="font-size:11px;font-weight:700;letter-spacing:0.1em">EXPECTED CASH</span>
        <span style="font-size:16px;font-weight:900">${phpFmt(s.expected_cash_php ?? 0)}</span>
      </div>
      <div class="row"><span class="label">Actual Cash</span><span class="val">${phpFmt(s.closing_cash_php ?? 0)}</span></div>
      <div class="row"><span class="label">Variance</span><span class="val" style="color:${variance === 0 ? '#007a55' : '#cc0000'}">${phpFmt(variance)}</span></div>

      ${ccyTable}

      <div style="text-align:center;font-size:10px;color:#aaa;margin-top:16px;padding-top:12px;border-top:1px solid #ddd">
        Kedco FX · Pusok, Lapu-Lapu City · Confidential — For Internal Use Only
      </div>
      <script>window.onload = () => { window.print(); }</script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=700,height=600');
    if (w) { w.document.write(html); w.document.close(); }
  }

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
            {(() => {
              const comm = shiftClosed.total_commission ?? 0;
              const repl = shiftClosed.total_replenishment_php ?? 0;
              const variance = shiftClosed.cash_variance ?? 0;
              const rows: [string, string, string?, number?][] = [
                ['Transactions',      String(shiftClosed.txn_count ?? 0)],
                ['Total Sold (PHP)',   php(shiftClosed.total_sold_php ?? 0),   '#f5a623'],
                ['Total Bought (PHP)', php(shiftClosed.total_bought_php ?? 0), '#5b8cff'],
                ['Total THAN',         php(shiftClosed.total_than ?? 0),       '#00d4aa'],
                ...(comm !== 0 ? [['Commission', (comm > 0 ? '-' : '+') + php(Math.abs(comm)), '#ff5c5c'] as [string, string, string]] : []),
                ...(repl !== 0 ? [['Replenishment', '+' + php(repl), '#00d4aa'] as [string, string, string]] : []),
                ['Opening Cash',       php(shiftClosed.opening_cash_php)],
                ['Expected Cash',      php(shiftClosed.expected_cash_php ?? 0), '#f5a623'],
                ['Actual Cash',        php(shiftClosed.closing_cash_php ?? 0)],
                ['Variance',           php(variance), variance === 0 ? '#00d4aa' : '#ff5c5c', 700],
              ];
              return rows.map(([k, v, color, fw]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{k}</span>
                  <span style={{ ...M, fontSize: 12, color: color ?? '#e2e6f0', fontWeight: (fw as number | undefined) ?? 400 }}>{v}</span>
                </div>
              ));
            })()}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => printShift(shiftClosed)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 10, border: '1px solid rgba(0,212,170,0.35)',
                  background: 'rgba(0,212,170,0.08)', color: '#00d4aa',
                  ...M, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                🖨 Print
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 2, padding: '14px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#00d4aa,#00a884)',
                  color: '#000', ...Y, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}
              >
                LOGOUT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPLENISH MODAL ── */}
      {showReplenishModal && shift && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.2em', marginBottom: 4 }}>CASH REPLENISHMENT</div>
                <div style={{ ...Y, fontSize: 20, fontWeight: 800 }}>Add Cash to Drawer</div>
              </div>
              <button onClick={() => setShowReplenishModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {/* Running total so far */}
            {(shift.replenishments?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                {shift.replenishments!.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{r.note || 'Replenishment'}</span>
                    <span style={{ ...M, fontSize: 12, color: '#00d4aa' }}>+{php(r.amount_php)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 2 }}>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>TOTAL REPLENISHED</span>
                  <span style={{ ...M, fontSize: 12, color: '#00d4aa', fontWeight: 700 }}>+{php(shift.total_replenishment_php ?? 0)}</span>
                </div>
              </div>
            )}

            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              AMOUNT (PHP)
            </label>
            <input
              type="text" inputMode="decimal"
              ref={replenishInput.ref}
              value={replenishInput.value}
              onChange={replenishInput.onChange}
              onFocus={replenishInput.onFocus}
              placeholder="0.00" autoFocus
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid rgba(0,212,170,0.4)',
                borderRadius: 8, padding: '14px 16px', color: '#00d4aa',
                ...M, fontSize: 22, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
              }}
            />
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              NOTE (optional)
            </label>
            <input
              type="text"
              value={replenishNote}
              onChange={e => setReplenishNote(e.target.value)}
              placeholder="e.g. from safe, branch replenishment..."
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: '#e2e6f0',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />

            {replenishError && (
              <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginTop: 12 }}>✗ {replenishError}</div>
            )}

            <button
              onClick={handleReplenish}
              disabled={replenishLoading || !replenishInput.value}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none', marginTop: 20,
                background: replenishLoading || !replenishInput.value ? 'var(--border)' : 'linear-gradient(135deg,#00d4aa,#00a884)',
                color: replenishLoading || !replenishInput.value ? 'var(--muted)' : '#000',
                ...Y, fontSize: 14, fontWeight: 800, cursor: replenishLoading || !replenishInput.value ? 'not-allowed' : 'pointer',
              }}
            >
              {replenishLoading ? 'SAVING...' : 'ADD CASH'}
            </button>
          </div>
        </div>
      )}

      {/* ── END SHIFT MODAL ── */}
      {showEndModal && shift && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxHeight: '90vh', overflowY: 'auto' }}>
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
            {(() => {
              const comm = shift.total_commission ?? totalCommission;
              const rows: [string, string, string?][] = [
                ['Transactions',       String(shift.txn_count ?? txns.length)],
                ['Total Sold (PHP)',   php(shift.total_sold_php ?? txns.filter(t=>t.type==='SELL').reduce((s,t)=>s+t.phpAmt,0))],
                ['Total Bought (PHP)', php(shift.total_bought_php ?? txns.filter(t=>t.type==='BUY').reduce((s,t)=>s+t.phpAmt,0))],
                ...(comm !== 0 ? [['Commission', (comm > 0 ? '-' : '+') + php(Math.abs(comm)), '#ff5c5c'] as [string, string, string]] : []),
                ...((shift.total_replenishment_php ?? 0) !== 0 ? [['Replenishment', '+' + php(shift.total_replenishment_php ?? 0), '#00d4aa'] as [string, string, string]] : []),
                ['Opening Cash',       php(shift.opening_cash_php)],
              ];
              return rows.map(([k, v, color]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '7px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{k}</span>
                  <span style={{ ...M, fontSize: 12, color: color ?? '#e2e6f0' }}>{v}</span>
                </div>
              ));
            })()}

            {/* Per-currency breakdown */}
            {(() => {
              const byCcy: Record<string, { buyQty: number; buyPhp: number; sellQty: number; sellPhp: number }> = {};
              for (const t of txns) {
                if (!byCcy[t.currency]) byCcy[t.currency] = { buyQty: 0, buyPhp: 0, sellQty: 0, sellPhp: 0 };
                if (t.type === 'BUY') { byCcy[t.currency].buyQty += t.foreignAmt; byCcy[t.currency].buyPhp += t.phpAmt; }
                else                  { byCcy[t.currency].sellQty += t.foreignAmt; byCcy[t.currency].sellPhp += t.phpAmt; }
              }
              const entries = Object.entries(byCcy);
              if (entries.length === 0) return null;
              return (
                <div style={{ marginTop: 12, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em' }}>
                    <span>CCY</span>
                    <span style={{ textAlign: 'right' }}>BUY QTY</span>
                    <span style={{ textAlign: 'right' }}>BUY PHP</span>
                    <span style={{ textAlign: 'right' }}>SELL QTY</span>
                    <span style={{ textAlign: 'right' }}>SELL PHP</span>
                  </div>
                  {entries.map(([code, d], i) => (
                    <div key={code} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', padding: '7px 10px', borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <span style={{ ...M, fontSize: 11, fontWeight: 700, color: '#e2e6f0' }}>{code}</span>
                      <span style={{ ...M, fontSize: 10, color: d.buyQty > 0 ? '#5b8cff' : 'var(--muted)', textAlign: 'right' }}>{d.buyQty > 0 ? fmtFx(d.buyQty, code, currencies) : '—'}</span>
                      <span style={{ ...M, fontSize: 10, color: d.buyPhp > 0 ? '#5b8cff' : 'var(--muted)', textAlign: 'right' }}>{d.buyPhp > 0 ? php(d.buyPhp) : '—'}</span>
                      <span style={{ ...M, fontSize: 10, color: d.sellQty > 0 ? '#f5a623' : 'var(--muted)', textAlign: 'right' }}>{d.sellQty > 0 ? fmtFx(d.sellQty, code, currencies) : '—'}</span>
                      <span style={{ ...M, fontSize: 10, color: d.sellPhp > 0 ? '#f5a623' : 'var(--muted)', textAlign: 'right' }}>{d.sellPhp > 0 ? php(d.sellPhp) : '—'}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Expected closing cash — cashier compares this against their physical count */}
            {(() => {
              const comm      = shift.total_commission ?? totalCommission;
              const repl      = shift.total_replenishment_php ?? 0;
              const soldAmt   = shift.total_sold_php   ?? txns.filter(t=>t.type==='SELL').reduce((s,t)=>s+t.phpAmt,0);
              const boughtAmt = shift.total_bought_php ?? txns.filter(t=>t.type==='BUY').reduce((s,t)=>s+t.phpAmt,0);
              const expected  = (shift.opening_cash_php ?? 0) + soldAmt - boughtAmt - comm + repl;
              return (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', marginTop: 12, borderRadius: 8,
                  background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.3)',
                }}>
                  <span style={{ ...M, fontSize: 11, color: '#f5a623', letterSpacing: '0.1em' }}>EXPECTED CASH</span>
                  <span style={{ ...Y, fontSize: 18, fontWeight: 800, color: '#f5a623' }}>{php(expected)}</span>
                </div>
              );
            })()}

            <div style={{ marginTop: 16 }}>
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

      {/* ── EDIT TRANSACTION MODAL ── */}
      {editTxn && editDraft && (
        <div style={overlayStyle}>
          <div style={{ ...cardStyle, maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ ...M, fontSize: 10, color: '#f5a623', letterSpacing: '0.2em', marginBottom: 4 }}>
                  {role === 'admin' ? 'EDIT TRANSACTION' : 'REQUEST EDIT'}
                </div>
                <div style={{ ...Y, fontSize: 18, fontWeight: 800 }}>{editTxn.id}</div>
                <div style={{ ...M, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                  {editTxn.type} · {editTxn.currency} · {editTxn.time}
                </div>
              </div>
              <button onClick={() => { setEditTxn(null); setEditDraft(null); setEditError(null); setEditSent(false); }}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18 }}>
                ✕
              </button>
            </div>

            {editSent ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                <div style={{ ...Y, fontSize: 16, fontWeight: 800, color: '#f5a623', marginBottom: 8 }}>Request Submitted</div>
                <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 24 }}>
                  Waiting for admin approval. The transaction will update once approved.
                </div>
                <button
                  onClick={() => { setEditTxn(null); setEditDraft(null); setEditSent(false); }}
                  style={{ padding: '10px 28px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', ...M, fontSize: 12, cursor: 'pointer' }}
                >Close</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {role !== 'admin' && (
                  <div style={{ ...M, fontSize: 10, color: 'var(--muted)', background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 8, padding: '8px 14px' }}>
                    Changes won&apos;t apply until admin approves.
                  </div>
                )}

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>CUSTOMER</label>
                  <input
                    type="text"
                    value={editDraft.customer}
                    onChange={e => setEditDraft({ ...editDraft, customer: e.target.value })}
                    placeholder="Name or reference"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>REFERRER <span style={{ opacity: 0.45 }}>(optional)</span></label>
                  <input
                    type="text"
                    value={editDraft.referrer}
                    onChange={e => setEditDraft({ ...editDraft, referrer: e.target.value })}
                    placeholder="Tour guide or referral source"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>PAYMENT MODE</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {PAY_MODES.map(m => (
                      <button key={m} type="button" onClick={() => { setEditDraft({ ...editDraft, payment_mode: m }); if (!NEEDS_BANK.includes(m as PayMode)) setEditBankId(null); }} style={{
                        padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${editDraft.payment_mode === m ? 'rgba(0,212,170,0.5)' : 'var(--border)'}`,
                        background: editDraft.payment_mode === m ? 'rgba(0,212,170,0.1)' : 'transparent',
                        color: editDraft.payment_mode === m ? '#00d4aa' : 'var(--muted)',
                        ...M, fontSize: 10,
                      }}>{m.replace('_', ' ')}</button>
                    ))}
                  </div>
                  {NEEDS_BANK.includes(editDraft.payment_mode as PayMode) && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>BANK</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {banks.map(b => (
                          <button key={b.id} type="button" onClick={() => setEditBankId(b.id)} style={{
                            padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                            border: `1px solid ${editBankId === b.id ? 'rgba(91,140,255,0.5)' : 'var(--border)'}`,
                            background: editBankId === b.id ? 'rgba(91,140,255,0.1)' : 'transparent',
                            color: editBankId === b.id ? '#5b8cff' : 'var(--muted)',
                            ...M, fontSize: 10,
                          }}>{b.code}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4,
                }}>
                  {(['BUY', 'SELL'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setEditDraft({ ...editDraft, type: t })} style={{
                      padding: '10px', border: '1px solid',
                      borderColor: editDraft.type === t ? (t === 'BUY' ? 'rgba(91,140,255,0.45)' : 'rgba(245,166,35,0.45)') : 'transparent',
                      borderRadius: 9, cursor: 'pointer',
                      background: editDraft.type === t ? (t === 'BUY' ? 'rgba(91,140,255,0.14)' : 'rgba(245,166,35,0.14)') : 'transparent',
                      color: editDraft.type === t ? (t === 'BUY' ? '#5b8cff' : '#f5a623') : 'var(--muted)',
                      ...M, fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', transition: 'all 0.15s',
                    }}>
                      {t === 'BUY' ? '↓ BUY' : '↑ SELL'}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>FOREIGN AMOUNT</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editDraft.foreign_amt}
                      onChange={e => setEditDraft({ ...editDraft, foreign_amt: e.target.value })}
                      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: '#e2e6f0', ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>RATE</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editDraft.rate}
                      onChange={e => setEditDraft({ ...editDraft, rate: e.target.value })}
                      style={{ width: '100%', background: 'var(--bg)', border: `1px solid ${editDraft.type === 'BUY' ? 'rgba(91,140,255,0.4)' : 'rgba(245,166,35,0.4)'}`, borderRadius: 8, padding: '10px 14px', color: editDraft.type === 'BUY' ? '#5b8cff' : '#f5a623', ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                    GUIDE RATE <span style={{ opacity: 0.45 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editDraft.official_rate}
                    onChange={e => setEditDraft({ ...editDraft, official_rate: e.target.value })}
                    placeholder="e.g. 56.50"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: '#e2e6f0', ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {(() => {
                  const r = parseFloat(editDraft.rate);
                  const a = parseFloat(editDraft.foreign_amt);
                  const preview = !isNaN(r) && !isNaN(a) && r > 0 && a > 0 ? r * a : null;
                  return preview != null ? (
                    <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>
                      PHP preview: <span style={{ color: '#00d4aa' }}>{php(preview)}</span>
                    </div>
                  ) : null;
                })()}

                {(() => {
                  const r = parseFloat(editDraft.rate);
                  const a = parseFloat(editDraft.foreign_amt);
                  const offRate = parseFloat(editDraft.official_rate);
                  if (!offRate || isNaN(r) || isNaN(a) || r <= 0 || a <= 0) return null;
                  const comm = editDraft.type === 'SELL'
                    ? (r - offRate) * a
                    : (offRate - r) * a;
                  if (comm === 0) return null;
                  const cashierCut = editDraft.referrer ? comm / 2 : comm;
                  const refCut     = editDraft.referrer ? comm / 2 : 0;
                  return (
                    <div style={{
                      background: comm > 0 ? 'rgba(0,212,170,0.05)' : 'rgba(255,92,92,0.05)',
                      border: `1px solid ${comm > 0 ? 'rgba(0,212,170,0.2)' : 'rgba(255,92,92,0.2)'}`,
                      borderRadius: 10, padding: '10px 14px',
                    }}>
                      <div style={{ ...M, fontSize: 9, color: comm > 0 ? '#00d4aa' : '#ff5c5c', letterSpacing: '0.12em', marginBottom: 6 }}>
                        COMMISSION PREVIEW
                      </div>
                      <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
                        Guide rate: <span style={{ color: '#e2e6f0' }}>{offRate}</span>
                      </div>
                      <div style={{ ...M, fontSize: 12, color: comm > 0 ? '#00d4aa' : '#ff5c5c' }}>
                        Total: {php(Math.abs(comm))}
                        {editDraft.referrer && <> · You: {php(Math.abs(cashierCut))} · {editDraft.referrer}: {php(Math.abs(refCut))}</>}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                    REASON <span style={{ opacity: 0.45 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editDraft.note}
                    onChange={e => setEditDraft({ ...editDraft, note: e.target.value })}
                    placeholder="e.g. wrong rate entered"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: '#e2e6f0', ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {editError && (
                  <div style={{ ...M, fontSize: 11, color: '#ff5c5c', background: 'rgba(255,92,92,0.08)', border: '1px solid rgba(255,92,92,0.2)', borderRadius: 8, padding: '8px 14px' }}>
                    ✗ {editError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => { setEditTxn(null); setEditDraft(null); setEditError(null); }}
                    style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', ...M, fontSize: 12, cursor: 'pointer' }}
                  >Cancel</button>
                  <button
                    onClick={role === 'admin' ? handleAdminEdit : handleEditRequest}
                    disabled={editLoading}
                    data-testid="edit-submit-btn"
                    style={{ padding: '12px', borderRadius: 8, border: 'none', background: editLoading ? 'var(--border)' : 'linear-gradient(135deg,#f5a623,#e09000)', color: editLoading ? 'var(--muted)' : '#000', ...Y, fontSize: 13, fontWeight: 800, cursor: editLoading ? 'not-allowed' : 'pointer' }}
                  >{editLoading ? (role === 'admin' ? 'SAVING...' : 'SUBMITTING...') : (role === 'admin' ? 'SAVE CHANGES' : 'SEND REQUEST')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NO RATES BLOCKING OVERLAY (sits above shift overlay — zIndex 300) ── */}
      {noRatesAtAll && (
        <div style={{ ...overlayStyle, zIndex: 300 }}>
          <div style={cardStyle}>
            <div style={{ ...M, fontSize: 10, color: '#f5a623', letterSpacing: '0.2em', marginBottom: 8 }}>
              SETUP REQUIRED
            </div>
            <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              Rates Not Set Yet
            </div>
            <div style={{ ...M, fontSize: 12, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.7 }}>
              Today&apos;s buy/sell rates haven&apos;t been set. You cannot process transactions until admin sets them. Ask your admin or supervisor to go to{' '}
              <span style={{ color: '#00d4aa' }}>/admin/rates</span> and set today&apos;s rates.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: '1px solid rgba(245,166,35,0.3)',
                background: 'rgba(245,166,35,0.08)', color: '#f5a623',
                ...M, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em',
              }}
            >
              CHECK AGAIN
            </button>
          </div>
        </div>
      )}

      {/* ── PARTIAL RATES BANNER (some currencies missing rates) ── */}
      {!noRatesAtAll && ratesCount < currencies.length && (
        <div style={{
          background: 'rgba(245,166,35,0.06)', borderBottom: '1px solid rgba(245,166,35,0.2)',
          padding: `10px ${px}px`, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 14 }}>ℹ️</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#f5a623' }}>
            Rates set for {ratesCount} of {currencies.length} currencies today. Currencies without rates require manual rate entry.
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
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
          {!isMobile && (
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>
              <span style={{ color: '#e2e6f0' }}>{username}</span>
            </div>
          )}
          {shift && (<>
            <button
              onClick={() => { setReplenishError(null); replenishInput.setValue(''); setReplenishNote(''); setShowReplenishModal(true); }}
              style={{
                padding: '5px 10px', borderRadius: 6,
                border: '1px solid rgba(0,212,170,0.35)',
                background: 'rgba(0,212,170,0.07)',
                color: '#00d4aa', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
              }}
            >
              REPL
            </button>
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
          </>)}
          {role === 'admin' && (<>
            <a href="/" style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em', textDecoration: 'none' }}>
              DASHBOARD
            </a>
            <a href="/admin" style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em', textDecoration: 'none' }}>
              ADMIN
            </a>
          </>)}
          {!isMobile && <a href="/passbook" style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(0,212,170,0.3)', background: 'transparent', color: '#00d4aa', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em', textDecoration: 'none' }}>
            PASSBOOK
          </a>}
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
          <div style={{ position: 'relative' }}>
            <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              CURRENCY
            </label>
            <input
              type="text"
              autoComplete="off"
              placeholder="— Type code or country —"
              value={ccyOpen ? ccyQuery : (ccy ? `${ccy.flag} ${ccy.code} — ${ccy.name}` : '')}
              onFocus={() => { setCcyOpen(true); setCcyQuery(''); }}
              onBlur={() => setTimeout(() => setCcyOpen(false), 150)}
              onChange={e => setCcyQuery(e.target.value)}
              style={{
                width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px', boxSizing: 'border-box',
                color: ccy && !ccyOpen ? '#e2e6f0' : 'var(--muted)',
                ...M, fontSize: 13, outline: 'none', cursor: 'text',
              }}
            />
            {ccyOpen && (() => {
              const q = ccyQuery.toLowerCase();
              const filtered = currencies.filter(c =>
                !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
              );
              return (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, marginTop: 4,
                  maxHeight: 220, overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  {filtered.length === 0 && (
                    <div style={{ ...M, fontSize: 12, color: 'var(--muted)', padding: '10px 14px' }}>
                      No match
                    </div>
                  )}
                  {filtered.map(c => (
                    <div
                      key={c.code}
                      data-testid={`currency-option-${c.code}`}
                      onMouseDown={() => { setCcy(c); setCcyQuery(''); setCcyOpen(false); }}
                      style={{
                        padding: '10px 14px', cursor: 'pointer',
                        opacity: 1,
                        display: 'flex', gap: 10, alignItems: 'center',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 18 }}>{c.flag}</span>
                      <span style={{ ...M, fontSize: 13, color: '#e2e6f0', fontWeight: 700 }}>{c.code}</span>
                      <span style={{ ...M, fontSize: 11, color: 'var(--muted)', flex: 1 }}>{c.name}</span>
                      {!c.rateSet && <span style={{ ...M, fontSize: 10, color: '#ff5c5c' }}>no rate</span>}
                    </div>
                  ))}
                </div>
              );
            })()}
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
              <div style={{ ...M, fontSize: 10, color: '#f5a623', marginTop: 6 }}>
                No rate set for today — enter the rate manually below.
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

          {/* Guide Rate — cashier/admin only */}
          {role !== 'supervisor' && (
            <div>
              <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
                GUIDE RATE <span style={{ opacity: 0.45 }}>(your base — for commission)</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                ref={guideRateInput.ref}
                value={guideRateInput.value}
                onChange={guideRateInput.onChange}
                onFocus={guideRateInput.onFocus}
                placeholder="e.g. 59.00"
                style={{
                  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', color: 'var(--muted)',
                  ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

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

          {/* Commission Preview — cashier/admin only, requires guide rate */}
          {role !== 'supervisor' && +rateInput.raw > 0 && +amtInput.raw > 0 && +guideRateInput.raw > 0 && (() => {
            const offRate = +guideRateInput.raw;
            // SELL: earn when rate > guide. BUY: earn when rate < guide.
            const commission = type === 'SELL'
              ? (+rateInput.raw - offRate) * +amtInput.raw
              : (offRate - +rateInput.raw) * +amtInput.raw;
            if (commission === 0) return null;
            const cashierCut = referrer ? commission / 2 : commission;
            const refCut = referrer ? commission / 2 : 0;
            return (
              <div style={{
                background: commission > 0 ? 'rgba(0,212,170,0.05)' : 'rgba(255,92,92,0.05)',
                border: `1px solid ${commission > 0 ? 'rgba(0,212,170,0.2)' : 'rgba(255,92,92,0.2)'}`,
                borderRadius: 10, padding: '10px 14px',
              }}>
                <div style={{ ...M, fontSize: 9, color: commission > 0 ? '#00d4aa' : '#ff5c5c', letterSpacing: '0.12em', marginBottom: 6 }}>
                  COMMISSION PREVIEW
                </div>
                <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
                  Spread: <span style={{ color: '#e2e6f0' }}>{commission > 0 ? '+' : '-'}{php(Math.abs(commission / +amtInput.raw))}</span> per unit
                </div>
                <div style={{ ...M, fontSize: 12, color: commission > 0 ? '#00d4aa' : '#ff5c5c' }}>
                  Total: {php(Math.abs(commission))}
                  {referrer && <> · You: {php(Math.abs(cashierCut))} · {referrer}: {php(Math.abs(refCut))}</>}
                </div>
              </div>
            );
          })()}

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
            {role !== 'supervisor' && (
              <input
                type="text"
                value={referrer}
                onChange={e => setReferrer(e.target.value)}
                placeholder="Referrer / tour guide (optional)"
                style={{
                  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', color: '#e2e6f0',
                  ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* Supervisor: reference date + advance/late tag */}
          {role === 'supervisor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em' }}>
                PAYMENT DATE <span style={{ opacity: 0.45 }}>(reference)</span>
              </label>
              <input
                type="date"
                value={referenceDate}
                onChange={e => setReferenceDate(e.target.value)}
                style={{
                  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', color: '#e2e6f0',
                  ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                {(['', 'ADVANCE', 'LATE'] as const).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setPaymentTag(tag)}
                    style={{
                      padding: '6px 14px', borderRadius: 6, cursor: 'pointer', ...M, fontSize: 10,
                      border: `1px solid ${paymentTag === tag ? 'rgba(0,212,170,0.5)' : 'var(--border)'}`,
                      background: paymentTag === tag ? 'rgba(0,212,170,0.1)' : 'transparent',
                      color: paymentTag === tag ? '#00d4aa' : 'var(--muted)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {tag === '' ? 'REGULAR' : tag}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                  {m.replace('_', ' ')}
                </button>
              ))}
            </div>
            {NEEDS_BANK.includes(payMode) && (
              <div style={{ marginTop: 10 }}>
                <label style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                  {payMode === 'CHEQUE' ? 'BANK (CHEQUE)' : 'BANK'}
                </label>
                <select
                  value={bankId ?? ''}
                  onChange={e => setBankId(e.target.value ? +e.target.value : null)}
                  style={{
                    width: '100%', background: 'var(--surface)',
                    border: `1px solid ${bankId ? 'rgba(0,212,170,0.4)' : '#ff5c5c44'}`,
                    borderRadius: 8, padding: '10px 14px', boxSizing: 'border-box',
                    color: bankId ? '#e2e6f0' : 'var(--muted)',
                    ...M, fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="">Select bank…</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
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

          {/* Batch flash */}
          {batchFlash && batchFlash.length > 0 && (
            <div style={{
              background: 'rgba(0,212,170,0.07)', border: '1px solid rgba(0,212,170,0.3)',
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ ...Y, fontSize: 12, fontWeight: 700, color: '#00d4aa' }}>
                  ✓ Batch saved — {batchFlash.length} items
                </div>
                <button
                  onClick={() => printBatchReceipt(batchFlash)}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {batchFlash.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>
                      {t.currency} &nbsp;{fmtFx(t.foreignAmt, t.currency, currencies)} @ {t.rate}
                    </div>
                    <div style={{ ...M, fontSize: 11, color: '#00d4aa', fontWeight: 700 }}>{php(t.phpAmt)}</div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid rgba(0,212,170,0.2)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>TOTAL</span>
                  <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#00d4aa' }}>
                    {php(batchFlash.reduce((s, t) => s + t.phpAmt, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Single success flash */}
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

          {/* Cart */}
          {cart.length > 0 && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 10 }}>
                CART — {cart.length} ITEM{cart.length > 1 ? 'S' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cart.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, ...M, fontSize: 12, color: '#e2e6f0' }}>
                      {item.ccy.flag} {item.ccy.code} &nbsp;
                      {fmtFx(item.foreign_amt, item.ccy.code, currencies)} @ {item.rate}
                    </div>
                    <div style={{ ...M, fontSize: 12, color: '#00d4aa', fontWeight: 700, minWidth: 90, textAlign: 'right' }}>
                      {php(item.foreign_amt * item.rate)}
                    </div>
                    <button
                      onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--muted)',
                        cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}>SUBTOTAL</span>
                <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#e2e6f0' }}>
                  {php(cart.reduce((s, item) => s + item.foreign_amt * item.rate, 0))}
                </span>
              </div>
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  flex: 1, padding: '16px', borderRadius: 10, border: 'none',
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
                {loading ? 'PROCESSING...' : `CONFIRM ${type}`}
              </button>
              <button
                onClick={addToCart}
                disabled={!canSubmit}
                title="Add to cart for multi-currency batch"
                style={{
                  padding: '16px 18px', borderRadius: 10, border: '1px solid var(--border)',
                  background: !canSubmit ? 'transparent' : 'var(--surface)',
                  color: !canSubmit ? 'var(--muted)' : '#e2e6f0',
                  ...Y, fontSize: 18, fontWeight: 700,
                  cursor: !canSubmit ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                +
              </button>
            </div>
            {cart.length > 0 && (
              <button
                onClick={handleBatchSubmit}
                disabled={loading}
                style={{
                  padding: '16px', borderRadius: 10, border: 'none',
                  background: loading
                    ? 'var(--border)'
                    : type === 'BUY'
                      ? 'linear-gradient(135deg,#00d4aa,#009977)'
                      : 'linear-gradient(135deg,#b45cf5,#8a2be2)',
                  color: loading ? 'var(--muted)' : '#000',
                  ...Y, fontSize: 14, fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.04em', transition: 'all 0.2s',
                }}
              >
                {loading ? 'PROCESSING...' : `SUBMIT BATCH (${cart.length})`}
              </button>
            )}
          </div>
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
                {s.label === 'TOTAL BOUGHT' && totalCommission !== 0 && (
                  <>
                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em' }}>COMM</span>
                      <span style={{ ...M, fontSize: 11, fontWeight: 700, color: totalCommission > 0 ? '#00d4aa' : '#ff5c5c' }}>
                        {totalCommission > 0 ? '+' : ''}{php(totalCommission)}
                      </span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em' }}>TOTAL</span>
                      <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: '#e2e6f0' }}>
                        {php(totalBought + totalCommission)}
                      </span>
                    </div>
                  </>
                )}
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
                  gridTemplateColumns: '100px 48px 56px 64px 80px 100px 100px 120px 120px 48px',
                  padding: '8px 20px', borderBottom: '1px solid var(--border)',
                  ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em',
                  whiteSpace: 'nowrap',
                }}>
                  <span>RECEIPT</span>
                  <span>TIME</span>
                  <span>TYPE</span>
                  <span>MODE</span>
                  <span>CCY</span>
                  <span>FOREIGN</span>
                  <span>RATE</span>
                  <span>PHP AMT</span>
                  {role === 'supervisor' ? <span>TAG</span> : <span>COMM</span>}
                  <span />
                </div>

                <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                  {txns.map((t, i) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '100px 48px 56px 64px 80px 100px 100px 120px 120px 48px',
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
                      <span style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>
                        {(t.paymentMode ?? 'CASH') === 'BANK_TRANSFER' ? 'BANK' : (t.paymentMode ?? 'CASH') === 'SHOPEEPAY' ? 'SHPAY' : (t.paymentMode ?? 'CASH')}
                      </span>
                      <span style={{ ...M, fontSize: 13, color: '#e2e6f0' }}>{t.currency}</span>
                      <span style={{ ...M, fontSize: 12, color: '#e2e6f0' }}>
                        {fmtFx(t.foreignAmt, t.currency, currencies)}
                      </span>
                      <span style={{
                        ...M, fontSize: 11,
                        color: t.type === 'BUY' ? '#5b8cff' : '#f5a623',
                      }}>{t.rate}</span>
                      <span style={{ ...M, fontSize: 11, color: '#e2e6f0' }}>{php(t.phpAmt)}</span>
                      {role === 'supervisor' ? (
                        t.paymentTag ? (
                          <span style={{
                            ...M, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                            padding: '2px 5px', borderRadius: 4,
                            color: t.paymentTag === 'ADVANCE' ? '#00d4aa' : '#f5a623',
                            background: t.paymentTag === 'ADVANCE' ? 'rgba(0,212,170,0.12)' : 'rgba(245,166,35,0.12)',
                            border: `1px solid ${t.paymentTag === 'ADVANCE' ? 'rgba(0,212,170,0.3)' : 'rgba(245,166,35,0.3)'}`,
                          }}>{t.paymentTag}</span>
                        ) : <span />
                      ) : (() => {
                        if (!t.officialRate) return <span />;
                        const comm = t.type === 'SELL'
                          ? (t.rate - t.officialRate) * t.foreignAmt
                          : (t.officialRate - t.rate) * t.foreignAmt;
                        if (comm === 0) return <span />;
                        return (
                          <span style={{ ...M, fontSize: 10, color: comm > 0 ? '#00d4aa' : '#ff5c5c' }}>
                            {comm > 0 ? '+' : '-'}{php(Math.abs(comm))}
                          </span>
                        );
                      })()}
                      {pendingEdits.has(t.id) ? (
                        <span title="Edit request pending admin approval" style={{
                          ...M, fontSize: 9, color: '#f5a623',
                          background: 'rgba(245,166,35,0.12)',
                          border: '1px solid rgba(245,166,35,0.3)',
                          borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap',
                        }}>⏳</span>
                      ) : (
                        <button
                          onClick={() => openEdit(t)}
                          title={role === 'admin' ? 'Edit transaction' : 'Request edit'}
                          data-testid={`edit-btn-${t.id}`}
                          style={{
                            background: 'none', border: '1px solid var(--border)',
                            borderRadius: 4, color: 'var(--muted)', cursor: 'pointer',
                            ...M, fontSize: 10, padding: '2px 6px',
                          }}
                        >✎</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Expenses — cashier and supervisor only */}
          {(role === 'cashier' || role === 'supervisor') && (
            <ExpensePanel username={username} />
          )}
        </div>
      </div>
    </div>
  );
}
