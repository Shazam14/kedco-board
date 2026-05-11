'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { CurrencyMeta, Transaction } from '@/lib/types';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { useNumberInput } from '@/hooks/useNumberInput';
import IDScanner, { type ScannedID } from '@/app/_components/IDScanner';
import CustomerPicker from '@/app/_components/CustomerPicker';
import ExpensePanel from '@/app/_components/ExpensePanel';

const M: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const Y: React.CSSProperties = { fontFamily: 'var(--font-sans)' };

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
  ratesSet = false,
}: {
  currencies: CurrencyMeta[];
  banks: { id: number; name: string; code: string }[];
  username: string;
  role?: string;
  ratesSet?: boolean;
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

  // ── Branch & Terminal (Device Setup) ────────────────────────────────────
  const BRANCHES = [
    { code: 'MAIN',  name: 'Main',          address: 'ML Quezon National Highway, Pusok, Lapu Lapu City, Cebu' },
    { code: 'CTS',   name: 'CTS',           address: 'A-218 City Timesquare, Mantawe Ave., Mandaue City, Cebu' },
    { code: 'BAI',   name: 'Bai',           address: 'Bai Hotel, Piano Avenue COR C.D. Seno St. CSSEAZ Mantuyong, Mandaue City' },
    { code: 'SM',    name: 'SM',            address: 'Gspot Food park, Kaohsiung St., Mabolo, Cebu City' },
    { code: 'GOLD',  name: 'Gold',          address: 'Sitio Seabreeze, Pusok, Lapu-Lapu City' },
    { code: 'JMALL', name: 'Jmall',         address: 'V. Albino St. Bakilid, Mandaue City, Cebu' },
    { code: 'ESY2',  name: 'ESY 2',         address: 'ML Quezon National Highway, Pusok, Lapu Lapu City, Cebu' },
    { code: 'DATAG', name: 'Monekat Datag', address: 'Maribago, City of Lapu-Lapu, Cebu' },
    { code: 'MOBO',  name: 'Monekat Mobo',  address: 'Basdiot, Moalboal, Cebu' },
  ] as const;
  const TERMINALS = ['Counter 1', 'Counter 2', 'Counter 3', 'Rider Phone', 'Supervisor Tablet'] as const;
  const [branch,          setBranch]          = useState<string>('');
  const [terminal,        setTerminal]        = useState<string>('');
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [menuOpen,        setMenuOpen]        = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);
  const [deviceStep,      setDeviceStep]      = useState<1 | 2>(1);
  const [branchDraft,     setBranchDraft]     = useState('');
  const [terminalDraft,   setTerminalDraft]   = useState('');

  useEffect(() => {
    const savedBranch   = localStorage.getItem('kedco_branch')   ?? '';
    const savedTerminal = localStorage.getItem('kedco_terminal') ?? '';
    setBranch(savedBranch);
    setTerminal(savedTerminal);
    if (!savedBranch || !savedTerminal) {
      setDeviceStep(!savedBranch ? 1 : 2);
      setShowDeviceModal(true);
    }
  }, []);

  function saveDevice(b: string, t: string) {
    localStorage.setItem('kedco_branch',   b);
    localStorage.setItem('kedco_terminal', t);
    setBranch(b);
    setTerminal(t);
    setShowDeviceModal(false);
  }

  // ── Shift state ──────────────────────────────────────────────────────────
  type Replenishment = { id: string; amount_php: number; note?: string; added_at: string; source?: string };
  type InterBranchOut = { id: string; amount_php: number; note?: string; destination?: string; sent_at: string };
  type Shift = {
    id: string; cashier: string; cashier_name: string; status: string;
    opened_at: string; opening_cash_php: number;
    closing_cash_php?: number; expected_cash_php?: number; cash_variance?: number;
    txn_count?: number; total_sold_php?: number; total_bought_php?: number; total_than?: number;
    total_commission?: number; total_replenishment_php?: number;
    total_petty_cash_php?: number;
    replenishments?: Replenishment[];
    inter_branch_outflows?: InterBranchOut[];
    is_treasurer_shift?: boolean;
    overall_total_bought_php?: number;
    overall_total_sold_php?: number;
    from_dispatches_php?: number;
    from_cashier_php?: number;
    bale_peso_php?: number;
    inter_branch_in_php?: number;
    inter_branch_out_php?: number;
    vault_returns_php?: number;
    dispatches_out_php?: number;
    expenses_php?: number;
    cheques_cleared_php?: number;
    peso_ken_in_php?: number;
    peso_ken_out_php?: number;
    vale_in_php?: number;
    vale_out_php?: number;
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
  const [replenishSource,    setReplenishSource]    = useState<'SAFE' | 'INTER_BRANCH' | 'PESO_KEN' | 'VALE' | 'EXTERNAL' | 'OTHER'>('SAFE');
  const [replenishLoading,   setReplenishLoading]   = useState(false);
  const [replenishError,     setReplenishError]     = useState<string | null>(null);
  const [floatHint,          setFloatHint]          = useState<string | null>(null);
  const [showSendBranchModal, setShowSendBranchModal] = useState(false);
  const sendBranchInput = useNumberInput('', 2);
  const [sendBranchNote,    setSendBranchNote]    = useState('');
  const [sendBranchLoading, setSendBranchLoading] = useState(false);
  const [sendBranchError,   setSendBranchError]   = useState<string | null>(null);
  const [showToKenModal,    setShowToKenModal]    = useState(false);
  const toKenInput = useNumberInput('', 2);
  const [toKenNote,    setToKenNote]    = useState('');
  const [toKenLoading, setToKenLoading] = useState(false);
  const [toKenError,   setToKenError]   = useState<string | null>(null);
  // ── VALE (investor IOU) ───────────────────────────────────────────────────
  type ValeParty = { id: string; name: string; is_active: boolean };
  const [valeParties,        setValeParties]        = useState<ValeParty[]>([]);
  const [replenishPartyId,   setReplenishPartyId]   = useState<string>('');
  const [newPartyName,       setNewPartyName]       = useState<string>('');
  const [newPartySaving,     setNewPartySaving]     = useState(false);
  const [showToValeModal,    setShowToValeModal]    = useState(false);
  const toValeInput = useNumberInput('', 2);
  const [toValeNote,     setToValeNote]     = useState('');
  const [toValePartyId,  setToValePartyId]  = useState<string>('');
  const [toValeLoading,  setToValeLoading]  = useState(false);
  const [toValeError,    setToValeError]    = useState<string | null>(null);

  async function reloadValeParties() {
    if (role !== 'supervisor') return;
    try {
      const r = await fetch('/api/admin/vales/parties', { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) setValeParties(data.filter((p: ValeParty) => p.is_active));
      }
    } catch {}
  }
  useEffect(() => { reloadValeParties(); /* eslint-disable-next-line */ }, [role]);

  async function createValeParty(name: string): Promise<ValeParty | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    setNewPartySaving(true);
    try {
      const r = await fetch('/api/admin/vales/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await r.json();
      if (r.ok) {
        await reloadValeParties();
        return data as ValeParty;
      }
    } finally { setNewPartySaving(false); }
    return null;
  }

  useEffect(() => {
    fetch('/api/counter/shift', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const openShift = data.status === 'OPEN' ? data : null;
        setShift(openShift);
        if (!openShift) {
          const tid = localStorage.getItem('kedco_terminal') ?? '';
          const qs = tid ? `?terminal_id=${encodeURIComponent(tid)}` : '';
          fetch(`/api/counter/pending-float${qs}`, { cache: 'no-store' })
            .then(r => r.json())
            .then(f => {
              if (f && f.amount_php) {
                openingCashInput.setValue(String(f.amount_php));
                if (f.source === 'handoff') {
                  setFloatHint(`Handoff from ${f.cashier_name}`);
                } else {
                  setFloatHint(`Float from ${f.treasurer_name}`);
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setShift(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleOpenShift() {
    const cash = parseFloat(openingCashInput.raw);
    if (isNaN(cash) || cash < 0) { setShiftError('Enter a valid opening cash amount.'); return; }
    setShiftLoading(true); setShiftError(null);
    try {
      const res = await fetch('/api/counter/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', opening_cash_php: cash, terminal_id: terminal || undefined, branch_id: branch || undefined }),
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
    if (replenishSource === 'VALE' && !replenishPartyId) {
      setReplenishError('Pick a vale party (investor) or add a new one.');
      return;
    }
    setReplenishLoading(true); setReplenishError(null);
    try {
      const res = await fetch('/api/counter/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replenish', amount_php: amount, note: replenishNote || undefined,
          source: replenishSource,
          ...(replenishSource === 'VALE' ? { party_id: replenishPartyId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setReplenishError(data.detail ?? 'Failed to record replenishment.'); }
      else {
        setShift(data);
        setShowReplenishModal(false);
        replenishInput.setValue('');
        setReplenishNote('');
        setReplenishSource('SAFE');
        setReplenishPartyId('');
      }
    } finally { setReplenishLoading(false); }
  }

  async function handleToVale() {
    const amount = parseFloat(toValeInput.raw);
    if (isNaN(amount) || amount <= 0) { setToValeError('Enter a valid amount.'); return; }
    if (!toValePartyId) { setToValeError('Pick a vale party (investor).'); return; }
    setToValeLoading(true); setToValeError(null);
    try {
      const res = await fetch('/api/counter/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vale-out',
          amount_php: amount,
          party_id: toValePartyId,
          note: toValeNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setToValeError(data.detail ?? 'Failed to record return.'); }
      else {
        setShift(data);
        setShowToValeModal(false);
        toValeInput.setValue('');
        setToValeNote('');
        setToValePartyId('');
      }
    } finally { setToValeLoading(false); }
  }

  async function handleSendBranch() {
    const amount = parseFloat(sendBranchInput.raw);
    if (isNaN(amount) || amount <= 0) { setSendBranchError('Enter a valid amount.'); return; }
    setSendBranchLoading(true); setSendBranchError(null);
    try {
      const res = await fetch('/api/counter/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'inter-branch-out', amount_php: amount, note: sendBranchNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setSendBranchError(data.detail ?? 'Failed to record outflow.'); }
      else { setShift(data); setShowSendBranchModal(false); sendBranchInput.setValue(''); setSendBranchNote(''); }
    } finally { setSendBranchLoading(false); }
  }

  async function handleToKen() {
    const amount = parseFloat(toKenInput.raw);
    if (isNaN(amount) || amount <= 0) { setToKenError('Enter a valid amount.'); return; }
    setToKenLoading(true); setToKenError(null);
    try {
      const res = await fetch('/api/counter/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'peso-ken-out', amount_php: amount, note: toKenNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setToKenError(data.detail ?? 'Failed to record return.'); }
      else { setShift(data); setShowToKenModal(false); toKenInput.setValue(''); setToKenNote(''); }
    } finally { setToKenLoading(false); }
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
  const [custId,   setCustId]   = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState('');
  const [scanning, setScanning] = useState(false);
  const [referrer,       setReferrer]       = useState('');
  const [paymentTag,     setPaymentTag]     = useState<'ADVANCE' | 'LATE' | ''>('');
  const [referenceDate,  setReferenceDate]  = useState('');
  const [payMode,        setPayMode]        = useState<PayMode>('CASH');
  const [bankId,   setBankId]   = useState<number | null>(null);
  type SliceDraft = { method: PayMode; amountPhp: string; referenceNo: string };
  const [splitMode, setSplitMode] = useState(false);
  const [slices,    setSlices]    = useState<SliceDraft[]>([
    { method: 'CASH',  amountPhp: '', referenceNo: '' },
    { method: 'GCASH', amountPhp: '', referenceNo: '' },
  ]);
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

  const sliceSum   = slices.reduce((s, x) => s + (parseFloat(x.amountPhp) || 0), 0);
  const sliceDelta = phpTotal != null ? +(phpTotal - sliceSum).toFixed(2) : 0;
  const splitNeedsBank = splitMode && slices.some(s => NEEDS_BANK.includes(s.method));
  const slicesValid = splitMode
    && slices.length >= 2
    && slices.every(s => parseFloat(s.amountPhp) > 0)
    && Math.abs(sliceDelta) < 0.01;

  const canSubmit =
    !!ccy && !!amtInput.raw && +amtInput.raw > 0 && !!rateInput.raw && +rateInput.raw > 0 && !loading
    && (splitMode
      ? (slicesValid && (!splitNeedsBank || bankId !== null))
      : (!NEEDS_BANK.includes(payMode) || bankId !== null));

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
          customer_id: custId || undefined,
          id_number: idNumber || undefined,
          payment_mode: splitMode ? slices[0].method : payMode,
          bank_id: bankId ?? undefined,
          official_rate: +guideRateInput.raw > 0 ? +guideRateInput.raw : undefined,
          referrer: referrer || undefined,
          payment_tag: paymentTag || undefined,
          reference_date: (role === 'supervisor' && referenceDate) ? referenceDate : undefined,
          terminal_id: terminal || undefined,
          branch_id: branch || undefined,
          payments: splitMode
            ? slices.map(s => ({
                method: s.method,
                amount_php: parseFloat(s.amountPhp),
                reference_no: s.referenceNo || undefined,
              }))
            : undefined,
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
          paymentStatus: data.payment_status ?? 'RECEIVED',
          referenceDate: data.reference_date ?? undefined,
          payments: Array.isArray(data.payments) ? data.payments.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            method: p.method as string,
            amountPhp: p.amount_php as number,
            status: (p.status as 'RECEIVED' | 'PENDING'),
            referenceNo: (p.reference_no as string | null) ?? undefined,
            receivedAt: (p.received_at as string | null) ?? undefined,
            confirmedBy: (p.confirmed_by as string | null) ?? undefined,
          })) : [],
        };
        setFlash(txn);
        amtInput.setValue('');
        setCust('');
        setCustId(null);
        setIdNumber('');
        setReferrer('');
        guideRateInput.setValue('');
        setPaymentTag('');
        setReferenceDate(new Date().toISOString().split('T')[0]);
        setSplitMode(false);
        setSlices([
          { method: 'CASH',  amountPhp: '', referenceNo: '' },
          { method: 'GCASH', amountPhp: '', referenceNo: '' },
        ]);
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

    const branchAddr = BRANCHES.find(b => b.code === branch)?.address ?? 'Cebu, Philippines';

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
    padding: 3mm 3mm;
    font-size: 9pt;
    line-height: 1.5;
    width: 52mm;
    margin: 0 auto;
  }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  .lg     { font-size: 10pt; font-weight: bold; }
  .xl     { font-size: 12pt; font-weight: bold; }
  .dot    { border-top: 1px dashed #000; margin: 4px 0; }
  .row    { display: flex; justify-content: space-between; }
  .field  { margin-bottom: 1px; }
  @media print {
    body { padding: 2mm 2mm; width: 100%; }
    @page { margin: 0; size: 58mm auto; }
  }
</style>
<script>window.onload = () => window.print();</script>
</head>
<body>

<div class="center bold lg">Kedco Foreign Exchange Services</div>
<div class="center">${branchAddr}</div>

<div style="margin-top:4px">
  <div>${dateStr}</div>
  <div>${terminal || 'Counter'}</div>
  <div>OR#${txn.id}</div>
</div>

<div class="dot"></div>
<div class="center xl">${txn.type}</div>
<div class="dot"></div>

<table style="width:100%; border-collapse:collapse; font-size:9pt;">
  <tr>
    <td style="padding:2px 0; white-space:nowrap; font-weight:bold">${txn.currency}</td>
    <td style="padding:2px 0; text-align:center; white-space:nowrap">${fmtAmt}&nbsp;@&nbsp;${fmtRate}</td>
    <td style="padding:2px 0; text-align:right; white-space:nowrap; font-weight:bold">${fmtPhp}</td>
  </tr>
</table>

<div class="dot"></div>

<div class="row lg"><span>TOTAL</span><span>${fmtPhp}</span></div>
<div class="row"><span>${pm}</span><span>${fmtPhp}</span></div>

<div class="dot"></div>

<div class="field"># PAX &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</div>
<div class="field">CASHIER &nbsp;&nbsp;: ${txn.cashier}</div>

<div style="margin-top:5px"></div>

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
          customer_id: custId || undefined,
          payment_mode: payMode,
          bank_id: bankId ?? undefined,
          referrer: referrer || undefined,
          terminal_id: terminal || undefined,
          branch_id: branch || undefined,
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
        setCust(''); setCustId(null); setIdNumber(''); setReferrer('');
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
    const branchAddr = BRANCHES.find(b => b.code === branch)?.address ?? 'Cebu, Philippines';
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
        <td style="padding:2px 0;white-space:nowrap;font-weight:bold">${t.currency}</td>
        <td style="padding:2px 0;text-align:center;white-space:nowrap">${fmtAmt}&nbsp;@&nbsp;${fmtRate}</td>
        <td style="padding:2px 0;text-align:right;white-space:nowrap;font-weight:bold">${fmtPhp}</td>
      </tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>OR#${txns[0].id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Courier New',Courier,monospace;background:#fff;color:#000;padding:3mm 3mm;font-size:9pt;line-height:1.5;width:52mm;margin:0 auto}
  .center{text-align:center}.bold{font-weight:bold}.lg{font-size:10pt;font-weight:bold}.xl{font-size:12pt;font-weight:bold}
  .dot{border-top:1px dashed #000;margin:4px 0}.row{display:flex;justify-content:space-between}.field{margin-bottom:1px}
  @media print{body{padding:2mm 2mm;width:100%}@page{margin:0;size:58mm auto}}
</style>
<script>window.onload=()=>window.print();</script>
</head><body>
<div class="center bold lg">Kedco Foreign Exchange Services</div>
<div class="center">${branchAddr}</div>
<div style="margin-top:4px"><div>${dateStr}</div><div>${terminal || 'Counter'}</div><div>OR#${txns[0].id}</div></div>
<div class="dot"></div><div class="center xl">${txns[0].type}</div><div class="dot"></div>
<table style="width:100%;border-collapse:collapse;font-size:9pt;">${rows}</table>
<div class="dot"></div>
<div class="row lg"><span>TOTAL</span><span>&#8369;${fmtPhpTotal}</span></div>
<div class="row"><span>${pm}</span><span>&#8369;${fmtPhpTotal}</span></div>
<div class="dot"></div>
<div class="field"># PAX &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</div>
<div class="field">CASHIER &nbsp;&nbsp;: ${txns[0].cashier}</div>
<div style="margin-top:5px"></div>
<div class="field">SOLD TO &nbsp;&nbsp;: ${txns[0].customer ?? ''}</div>
<div class="field">ADDRESS &nbsp;&nbsp;:</div>
<div class="field">ID NO &nbsp;&nbsp;&nbsp;&nbsp;:</div>
<div class="field">BUSINESS STY :</div>
<div class="field">SIGNATURE &nbsp;:</div>
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

  // Running totals — supervisor sees only their own transactions in the counter panel
  const myTxns          = role === 'supervisor' ? txns.filter(t => t.cashier === username) : txns;
  const totalBought     = myTxns.filter(t => t.type === 'BUY').reduce((s, t) => s + t.phpAmt, 0);
  const totalSold       = myTxns.filter(t => t.type === 'SELL').reduce((s, t) => s + t.phpAmt, 0);
  const totalThan       = myTxns.reduce((s, t) => s + t.than, 0);
  const totalCommission = myTxns.reduce((s, t) => {
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
    const petty = s.total_petty_cash_php ?? 0;
    const variance = s.cash_variance ?? 0;

    // Per-currency breakdown from local txns
    const byCcy: Record<string, { buyQty: number; buyPhp: number; sellQty: number; sellPhp: number }> = {};
    for (const t of myTxns) {
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

      ${s.is_treasurer_shift ? `
        <div class="row"><span class="label">Total Bought (overall)</span><span class="val" style="color:#2255cc">${phpFmt(s.overall_total_bought_php ?? 0)}</span></div>
        <div class="row"><span class="label">Total Sold (overall)</span><span class="val" style="color:#c47000">${phpFmt(s.overall_total_sold_php ?? 0)}</span></div>
        <div class="row"><span class="label">Difference (overall)</span><span class="val">${phpFmt((s.overall_total_sold_php ?? 0) - (s.overall_total_bought_php ?? 0))}</span></div>
        <div class="row"><span class="label">Dispatched Out</span><span class="val" style="color:#cc0000">-${phpFmt(s.dispatches_out_php ?? 0)}</span></div>
        <div class="row"><span class="label">Remitted In (riders)</span><span class="val" style="color:#007a55">+${phpFmt(s.from_dispatches_php ?? 0)}</span></div>
        <div class="row"><span class="label">From Cashier</span><span class="val" style="color:#007a55">+${phpFmt(s.from_cashier_php ?? 0)}</span></div>
        <div class="row"><span class="label">Bale Peso (vault → drawer)</span><span class="val" style="color:#007a55">+${phpFmt(s.bale_peso_php ?? 0)}</span></div>
        ${(s.inter_branch_in_php ?? 0) > 0 ? `<div class="row"><span class="label">From Branch (inter-branch in)</span><span class="val" style="color:#007a55">+${phpFmt(s.inter_branch_in_php ?? 0)}</span></div>` : ''}
        ${(s.inter_branch_out_php ?? 0) > 0 ? `<div class="row"><span class="label">To Branch (inter-branch out)</span><span class="val" style="color:#cc0000">-${phpFmt(s.inter_branch_out_php ?? 0)}</span></div>` : ''}
        ${(s.peso_ken_in_php ?? 0) > 0 ? `<div class="row"><span class="label">From Ken (Ken float → drawer)</span><span class="val" style="color:#007a55">+${phpFmt(s.peso_ken_in_php ?? 0)}</span></div>` : ''}
        ${(s.peso_ken_out_php ?? 0) > 0 ? `<div class="row"><span class="label">To Ken (drawer → Ken float)</span><span class="val" style="color:#cc0000">-${phpFmt(s.peso_ken_out_php ?? 0)}</span></div>` : ''}
        ${(s.vault_returns_php ?? 0) !== 0 ? `<div class="row"><span class="label">Vault Movement (drawer ↔ vault)</span><span class="val" style="color:${(s.vault_returns_php ?? 0) >= 0 ? '#cc0000' : '#007a55'}">${(s.vault_returns_php ?? 0) >= 0 ? '-' : '+'}${phpFmt(Math.abs(s.vault_returns_php ?? 0))}</span></div>` : ''}
        ${(s.cheques_cleared_php ?? 0) > 0 ? `<div class="row"><span class="label">Cheques Cleared</span><span class="val" style="color:#007a55">+${phpFmt(s.cheques_cleared_php ?? 0)}</span></div>` : ''}
        ${(s.expenses_php ?? 0) > 0 ? `<div class="row"><span class="label">Expenses</span><span class="val" style="color:#cc0000">-${phpFmt(s.expenses_php ?? 0)}</span></div>` : ''}
        <div class="row"><span class="label">Opening Cash</span><span class="val">${phpFmt(s.opening_cash_php)}</span></div>
        <div class="highlight">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.1em">EXPECTED CASH</span>
          <span style="font-size:16px;font-weight:900">${phpFmt(s.expected_cash_php ?? 0)}</span>
        </div>
        <div class="row"><span class="label">Actual Cash</span><span class="val">${phpFmt(s.closing_cash_php ?? 0)}</span></div>
        <div class="row"><span class="label">Variance</span><span class="val" style="color:${variance === 0 ? '#007a55' : '#cc0000'}">${phpFmt(variance)}</span></div>
      ` : `
        <div class="row"><span class="label">Transactions</span><span class="val">${s.txn_count ?? myTxns.length}</span></div>
        <div class="row"><span class="label">Total Sold (PHP)</span><span class="val" style="color:#c47000">${phpFmt(s.total_sold_php ?? 0)}</span></div>
        <div class="row"><span class="label">Total Bought (PHP)</span><span class="val" style="color:#2255cc">${phpFmt(s.total_bought_php ?? 0)}</span></div>
        ${comm !== 0 ? `<div class="row"><span class="label">Commission</span><span class="val" style="color:#cc0000">${comm > 0 ? '-' : '+'}${phpFmt(Math.abs(comm))}</span></div>` : ''}
        <div class="row"><span class="label">Replenishment</span><span class="val" style="color:#007a55">+${phpFmt(repl)}</span></div>
        <div class="row"><span class="label">Petty Cash</span><span class="val" style="color:#cc0000">-${phpFmt(petty)}</span></div>
        <div class="row"><span class="label">Opening Cash</span><span class="val">${phpFmt(s.opening_cash_php)}</span></div>
        <div class="highlight">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.1em">EXPECTED CASH</span>
          <span style="font-size:16px;font-weight:900">${phpFmt(s.expected_cash_php ?? 0)}</span>
        </div>
        <div class="row"><span class="label">Actual Cash</span><span class="val">${phpFmt(s.closing_cash_php ?? 0)}</span></div>
        <div class="row"><span class="label">Variance</span><span class="val" style="color:${variance === 0 ? '#007a55' : '#cc0000'}">${phpFmt(variance)}</span></div>
      `}

      ${ccyTable}

      <div style="text-align:center;font-size:10px;color:#aaa;margin-top:16px;padding-top:12px;border-top:1px solid #ddd">
        Kedco FX · Pusok, Lapu-Lapu City · Confidential — For Internal Use Only
      </div>
      <script>window.onload = () => { window.print(); }</script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=700,height=600');
    if (w) { w.document.write(html); w.document.close(); }
  }

  const typeColor = type === 'BUY' ? 'var(--accent-sky)' : 'var(--accent-gold)';
  const noRatesAtAll = currencies.every(c => !c.rateSet);
  const ratesCount   = currencies.filter(c => c.rateSet).length;

  // Client-side positions check via Next.js proxy route
  const [positionsSet, setPositionsSet] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/counter/setup-status')
      .then(r => r.ok ? r.json() : null)
      .then((data: { positionsSet?: boolean } | null) => {
        if (data != null) setPositionsSet(data.positionsSet ?? false);
        // If fetch fails or returns null, leave positionsSet as null (don't block)
      })
      .catch(() => { /* leave as null — don't block if check unavailable */ });
  }, []);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(7,9,13,0.92)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  };
  const menuItemStyle: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 6, ...M, fontSize: 12,
    color: 'var(--text-strong)', textDecoration: 'none', border: 'none',
    letterSpacing: '0.04em', display: 'block',
  };
  const menuDivider: React.CSSProperties = {
    height: 1, background: 'var(--border-subtle)', margin: '4px 6px',
  };
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 16, padding: 32, width: '100%', maxWidth: 440,
  };

  // ── DAILY SETUP GUARD ─────────────────────────────────────────────────────
  // positionsSet is null while the client-side fetch is in flight — don't block during that window
  if (!ratesSet || positionsSet === false) {
    const checks = [
      { label: "Today's rates set",        done: ratesSet,               hint: "Admin needs to set buy/sell rates for today." },
      { label: "Opening positions set",    done: positionsSet === true,  hint: "Admin needs to set carry-in stock for today." },
    ];
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', color: 'var(--text)' }}>
        {/* nav */}
        <nav style={{ display: 'flex', alignItems: 'center', padding: `0 ${px}px`, height: '60px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--nav-bg)', backdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,var(--teal-300),var(--teal-600))', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text-on-teal)', fontFamily: 'var(--font-display)' }}>K</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>Kedco <span style={{ color: 'var(--teal-300)' }}>FX</span></div>
              <div style={{ ...M, fontSize: 9, color: 'var(--text-faint)' }}>Counter · {username}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ marginLeft: 'auto', ...M, fontSize: 10, background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', cursor: 'pointer' }}>LOGOUT</button>
        </nav>
        {/* guard card */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)', padding: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '36px 40px', width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-pop)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(212,166,74,0.12)', border: '1px solid rgba(212,166,74,0.3)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>⏳</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-strong)', marginBottom: 3 }}>Not ready yet</div>
                <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>Admin needs to complete daily setup before you can start.</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {checks.map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 12, background: c.done ? 'rgba(61,199,173,0.06)' : 'rgba(238,108,90,0.06)', border: `1px solid ${c.done ? 'rgba(61,199,173,0.2)' : 'rgba(238,108,90,0.2)'}` }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: c.done ? 'rgba(61,199,173,0.15)' : 'rgba(238,108,90,0.12)', color: c.done ? 'var(--teal-300)' : 'var(--accent-coral)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{c.done ? '✓' : '!'}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.done ? 'var(--teal-300)' : 'var(--text-strong)', marginBottom: 2 }}>{c.label}</div>
                    {!c.done && <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>{c.hint}</div>}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => window.location.reload()} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', ...M, fontSize: 12, cursor: 'pointer', letterSpacing: '0.08em' }}>
              REFRESH
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-strong)' }}>

      {/* ── DEVICE SETUP MODAL (branch + terminal, two steps) ── */}
      {showDeviceModal && (
        <div style={{ ...overlayStyle, zIndex: 400 }}>
          <div style={cardStyle}>
            <div style={{ ...M, fontSize: 10, color: 'var(--teal-300)', letterSpacing: '0.2em', marginBottom: 8 }}>
              THIS DEVICE — STEP {deviceStep} OF 2
            </div>
            {deviceStep === 1 ? (
              <>
                <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Select Branch</div>
                <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)', marginBottom: 28 }}>
                  Which branch is this device physically located at?
                </div>
                <select
                  value={branchDraft}
                  onChange={e => setBranchDraft(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '14px 16px', color: 'var(--text-strong)',
                    ...M, fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 20,
                  }}
                >
                  <option value="">— select branch —</option>
                  {BRANCHES.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
                <button
                  onClick={() => branchDraft && setDeviceStep(2)}
                  disabled={!branchDraft}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                    background: !branchDraft ? 'var(--border-subtle)' : 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
                    color: !branchDraft ? 'var(--text-muted)' : '#000',
                    ...Y, fontSize: 14, fontWeight: 800, cursor: !branchDraft ? 'not-allowed' : 'pointer',
                  }}
                >
                  NEXT →
                </button>
              </>
            ) : (
              <>
                <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Select Terminal</div>
                <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)', marginBottom: 28 }}>
                  Choose which terminal this device is. Shown on receipts.
                </div>
                <select
                  value={terminalDraft}
                  onChange={e => setTerminalDraft(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '14px 16px', color: 'var(--text-strong)',
                    ...M, fontSize: 16, outline: 'none', boxSizing: 'border-box', marginBottom: 20,
                  }}
                >
                  <option value="">— select terminal —</option>
                  {TERMINALS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setDeviceStep(1)}
                    style={{
                      flex: 1, padding: '14px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text-muted)',
                      ...Y, fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    ← BACK
                  </button>
                  <button
                    onClick={() => terminalDraft && saveDevice(branchDraft, terminalDraft)}
                    disabled={!terminalDraft}
                    style={{
                      flex: 2, padding: '14px', borderRadius: 10, border: 'none',
                      background: !terminalDraft ? 'var(--border-subtle)' : 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
                      color: !terminalDraft ? 'var(--text-muted)' : '#000',
                      ...Y, fontSize: 14, fontWeight: 800, cursor: !terminalDraft ? 'not-allowed' : 'pointer',
                    }}
                  >
                    CONFIRM
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── OPEN SHIFT OVERLAY (blocks counter until shift is opened) ── */}
      {shift === null && !shiftClosed && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ ...M, fontSize: 10, color: 'var(--teal-300)', letterSpacing: '0.2em', marginBottom: 8 }}>
              START SHIFT
            </div>
            <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              Open Your Shift
            </div>
            <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)', marginBottom: 28 }}>
              Count your drawer and enter the opening PHP cash before processing transactions.
            </div>

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              OPENING CASH (PHP)
              {floatHint && (
                <span style={{ marginLeft: 10, color: 'var(--teal-300)', fontSize: 9, letterSpacing: '0.05em' }}>
                  ↑ {floatHint}
                </span>
              )}
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
                borderRadius: 8, padding: '14px 16px', color: 'var(--text-strong)',
                ...M, fontSize: 24, outline: 'none', boxSizing: 'border-box', marginBottom: 20,
              }}
            />

            {shiftError && (
              <div style={{ ...M, fontSize: 11, color: 'var(--accent-coral)', marginBottom: 16 }}>✗ {shiftError}</div>
            )}

            <button
              onClick={handleOpenShift}
              disabled={shiftLoading || !openingCashInput.value}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: shiftLoading || !openingCashInput.value ? 'var(--border-subtle)' : 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
                color: shiftLoading || !openingCashInput.value ? 'var(--text-muted)' : '#000',
                ...Y, fontSize: 14, fontWeight: 800, cursor: shiftLoading || !openingCashInput.value ? 'not-allowed' : 'pointer',
              }}
            >
              {shiftLoading ? 'OPENING...' : 'OPEN SHIFT'}
            </button>

            <button
              onClick={handleLogout}
              style={{
                marginTop: 16, width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-muted)',
                ...M, fontSize: 12, cursor: 'pointer',
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}

      {/* ── SHIFT CLOSED CONFIRMATION ── */}
      {shiftClosed && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ ...M, fontSize: 10, color: 'var(--teal-300)', letterSpacing: '0.2em', marginBottom: 8 }}>
              SHIFT CLOSED
            </div>
            <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 24 }}>
              Shift Summary
            </div>
            {/* ── 2-card peso bookend (treasurer only) ─────────────────── */}
            {(shiftClosed.is_treasurer_shift ?? false) && (
              <div data-testid="treasurer-peso-bookend" style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18,
              }}>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 4 }}>OPENING PESO</div>
                  <div style={{ ...Y, fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>{php(shiftClosed.opening_cash_php)}</div>
                </div>
                <div style={{ background: 'rgba(61,199,173,0.08)', border: '1px solid rgba(61,199,173,0.3)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ ...M, fontSize: 9, color: 'var(--teal-300)', letterSpacing: '0.15em', marginBottom: 4 }}>CLOSING PESO</div>
                  <div style={{ ...Y, fontSize: 18, fontWeight: 800, color: 'var(--teal-300)' }}>{php(shiftClosed.expected_cash_php ?? 0)}</div>
                </div>
              </div>
            )}
            {(() => {
              const isTreasurer = shiftClosed.is_treasurer_shift ?? false;
              const variance = shiftClosed.cash_variance ?? 0;
              let rows: [string, string, string?, number?][];
              if (isTreasurer) {
                const overallBought = shiftClosed.overall_total_bought_php ?? 0;
                const overallSold   = shiftClosed.overall_total_sold_php   ?? 0;
                const bale          = shiftClosed.bale_peso_php            ?? 0;
                const interBranch   = shiftClosed.inter_branch_in_php      ?? 0;
                const interBranchOut = shiftClosed.inter_branch_out_php    ?? 0;
                const pesoKenIn     = shiftClosed.peso_ken_in_php          ?? 0;
                const pesoKenOut    = shiftClosed.peso_ken_out_php         ?? 0;
                const vaultReturns  = shiftClosed.vault_returns_php        ?? 0;
                const expenses      = shiftClosed.expenses_php             ?? 0;
                const cheques       = shiftClosed.cheques_cleared_php      ?? 0;
                rows = [
                  ['Total Bought (overall)',     php(overallBought),               'var(--accent-sky)'],
                  ['Total Sold (overall)',       php(overallSold),                 'var(--accent-gold)'],
                  ['Difference (overall)',       php(overallSold - overallBought), 'var(--text-strong)'],
                  ['Dispatched Out',             '-' + php(shiftClosed.dispatches_out_php ?? 0), 'var(--accent-coral)'],
                  ['Remitted In (riders)',       '+' + php(shiftClosed.from_dispatches_php ?? 0), 'var(--teal-300)'],
                  ['From Cashier',               '+' + php(shiftClosed.from_cashier_php    ?? 0), 'var(--teal-300)'],
                  ['Bale Peso (vault → drawer)', '+' + php(bale),                  'var(--teal-300)'],
                  ...(interBranch > 0 ? [['From Branch (inter-branch in)', '+' + php(interBranch), 'var(--teal-300)']] as [string, string, string?, number?][] : []),
                  ...(interBranchOut > 0 ? [['To Branch (inter-branch out)', '-' + php(interBranchOut), 'var(--accent-coral)']] as [string, string, string?, number?][] : []),
                  ...(pesoKenIn > 0 ? [['From Ken (Ken float → drawer)', '+' + php(pesoKenIn), 'var(--teal-300)']] as [string, string, string?, number?][] : []),
                  ...(pesoKenOut > 0 ? [['To Ken (drawer → Ken float)', '-' + php(pesoKenOut), 'var(--accent-coral)']] as [string, string, string?, number?][] : []),
                  ...(vaultReturns !== 0 ? [['Vault Movement (drawer ↔ vault)', (vaultReturns >= 0 ? '-' : '+') + php(Math.abs(vaultReturns)), vaultReturns >= 0 ? 'var(--accent-coral)' : 'var(--teal-300)']] as [string, string, string?, number?][] : []),
                  ...(cheques > 0      ? [['Cheques Cleared', '+' + php(cheques), 'var(--teal-300)']]      as [string, string, string?, number?][] : []),
                  ...(expenses > 0     ? [['Expenses',        '-' + php(expenses), 'var(--accent-coral)']] as [string, string, string?, number?][] : []),
                  ['Opening Cash',               php(shiftClosed.opening_cash_php)],
                  ['Expected Cash',              php(shiftClosed.expected_cash_php ?? 0), 'var(--accent-gold)'],
                  ['Actual Cash',                php(shiftClosed.closing_cash_php ?? 0)],
                  ['Variance',                   php(variance), variance === 0 ? 'var(--teal-300)' : 'var(--accent-coral)', 700],
                ];
              } else {
                const comm = shiftClosed.total_commission ?? 0;
                const repl = shiftClosed.total_replenishment_php ?? 0;
                const petty = shiftClosed.total_petty_cash_php ?? 0;
                rows = [
                  ['Transactions',      String(shiftClosed.txn_count ?? 0)],
                  ['Total Sold (PHP)',   php(shiftClosed.total_sold_php ?? 0),              'var(--accent-gold)'],
                  ['Total Bought (PHP)', php((shiftClosed.total_bought_php ?? 0) + comm),   'var(--accent-sky)'],
                  ['Replenishment',      '+' + php(repl), 'var(--teal-300)'],
                  ['Petty Cash',         '-' + php(petty), 'var(--accent-coral)'],
                  ['Opening Cash',       php(shiftClosed.opening_cash_php)],
                  ['Expected Cash',      php(shiftClosed.expected_cash_php ?? 0), 'var(--accent-gold)'],
                  ['Actual Cash',        php(shiftClosed.closing_cash_php ?? 0)],
                  ['Variance',           php(variance), variance === 0 ? 'var(--teal-300)' : 'var(--accent-coral)', 700],
                ];
              }
              return rows.map(([k, v, color, fw]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ ...M, fontSize: 12, color: color ?? 'var(--text-strong)', fontWeight: (fw as number | undefined) ?? 400 }}>{v}</span>
                </div>
              ));
            })()}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => printShift(shiftClosed)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 10, border: '1px solid rgba(61,199,173,0.35)',
                  background: 'rgba(61,199,173,0.08)', color: 'var(--teal-300)',
                  ...M, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                🖨 Print
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 2, padding: '14px', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
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
                <div style={{ ...M, fontSize: 10, color: 'var(--teal-300)', letterSpacing: '0.2em', marginBottom: 4 }}>CASH REPLENISHMENT</div>
                <div style={{ ...Y, fontSize: 20, fontWeight: 800 }}>Add Cash to Drawer</div>
              </div>
              <button onClick={() => setShowReplenishModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {/* Running total so far */}
            {(shift.replenishments?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                {shift.replenishments!.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>{r.note || 'Replenishment'}</span>
                    <span style={{ ...M, fontSize: 12, color: 'var(--teal-300)' }}>+{php(r.amount_php)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 2 }}>
                  <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>TOTAL REPLENISHED</span>
                  <span style={{ ...M, fontSize: 12, color: 'var(--teal-300)', fontWeight: 700 }}>+{php(shift.total_replenishment_php ?? 0)}</span>
                </div>
              </div>
            )}

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
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
                width: '100%', background: 'var(--bg)', border: '1px solid rgba(61,199,173,0.4)',
                borderRadius: 8, padding: '14px 16px', color: 'var(--teal-300)',
                ...M, fontSize: 22, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
              }}
            />
            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              SOURCE
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {(role === 'supervisor'
                ? (['SAFE', 'INTER_BRANCH', 'PESO_KEN', 'VALE', 'EXTERNAL', 'OTHER'] as const)
                : (['SAFE', 'EXTERNAL', 'OTHER'] as const)
              ).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setReplenishSource(s)}
                  data-testid={`replenish-source-${s}`}
                  style={{
                    flex: '1 1 70px', padding: '10px 8px', borderRadius: 8,
                    border: replenishSource === s ? '1px solid var(--teal-300)' : '1px solid var(--border)',
                    background: replenishSource === s ? 'rgba(61,199,173,0.12)' : 'transparent',
                    color: replenishSource === s ? 'var(--teal-300)' : 'var(--text-muted)',
                    ...M, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer',
                  }}
                >
                  {s === 'SAFE' ? 'VAULT' : s === 'INTER_BRANCH' ? 'FROM BRANCH' : s === 'PESO_KEN' ? 'FROM KEN' : s === 'VALE' ? 'FROM VALE' : s}
                </button>
              ))}
            </div>

            {replenishSource === 'VALE' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
                  VALE PARTY (INVESTOR)
                </label>
                <select
                  value={replenishPartyId}
                  onChange={e => setReplenishPartyId(e.target.value)}
                  data-testid="replenish-vale-party"
                  style={{
                    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                    ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8,
                  }}
                >
                  <option value="">— pick party —</option>
                  {valeParties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={newPartyName}
                    onChange={e => setNewPartyName(e.target.value)}
                    placeholder="+ new party name (e.g. Ike)"
                    style={{
                      flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '8px 12px', color: 'var(--text-strong)',
                      ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <button
                    type="button"
                    disabled={newPartySaving || !newPartyName.trim()}
                    onClick={async () => {
                      const created = await createValeParty(newPartyName);
                      if (created) {
                        setReplenishPartyId(created.id);
                        setNewPartyName('');
                      }
                    }}
                    style={{
                      padding: '8px 14px', borderRadius: 8,
                      border: '1px solid var(--teal-300)',
                      background: newPartySaving || !newPartyName.trim() ? 'transparent' : 'rgba(61,199,173,0.12)',
                      color: 'var(--teal-300)',
                      ...M, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                      cursor: newPartySaving || !newPartyName.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {newPartySaving ? '…' : 'ADD'}
                  </button>
                </div>
              </div>
            )}

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              NOTE (optional)
            </label>
            <input
              type="text"
              value={replenishNote}
              onChange={e => setReplenishNote(e.target.value)}
              placeholder={replenishSource === 'INTER_BRANCH' ? 'e.g. from CTS, from Banaue...' : 'e.g. from safe, branch replenishment...'}
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />

            {replenishError && (
              <div style={{ ...M, fontSize: 11, color: 'var(--accent-coral)', marginTop: 12 }}>✗ {replenishError}</div>
            )}

            <button
              onClick={handleReplenish}
              disabled={replenishLoading || !replenishInput.value}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none', marginTop: 20,
                background: replenishLoading || !replenishInput.value ? 'var(--border-subtle)' : 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
                color: replenishLoading || !replenishInput.value ? 'var(--text-muted)' : '#000',
                ...Y, fontSize: 14, fontWeight: 800, cursor: replenishLoading || !replenishInput.value ? 'not-allowed' : 'pointer',
              }}
            >
              {replenishLoading ? 'SAVING...' : 'ADD CASH'}
            </button>
          </div>
        </div>
      )}

      {/* ── SEND TO BRANCH MODAL (treasurer only) ── */}
      {showSendBranchModal && shift && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ ...M, fontSize: 10, color: 'var(--accent-coral)', letterSpacing: '0.2em', marginBottom: 4 }}>INTER-BRANCH OUTFLOW</div>
                <div style={{ ...Y, fontSize: 20, fontWeight: 800 }}>Send Cash to Branch</div>
              </div>
              <button onClick={() => setShowSendBranchModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {(shift.inter_branch_outflows?.filter(o => (o.destination ?? 'BRANCH') === 'BRANCH').length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                {shift.inter_branch_outflows!.filter(o => (o.destination ?? 'BRANCH') === 'BRANCH').map(o => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>{o.note || 'Outflow'}</span>
                    <span style={{ ...M, fontSize: 12, color: 'var(--accent-coral)' }}>−{php(o.amount_php)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 2 }}>
                  <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>TOTAL SENT</span>
                  <span style={{ ...M, fontSize: 12, color: 'var(--accent-coral)', fontWeight: 700 }}>−{php(shift.inter_branch_out_php ?? 0)}</span>
                </div>
              </div>
            )}

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              AMOUNT (PHP)
            </label>
            <input
              type="text" inputMode="decimal"
              ref={sendBranchInput.ref}
              value={sendBranchInput.value}
              onChange={sendBranchInput.onChange}
              onFocus={sendBranchInput.onFocus}
              placeholder="0.00" autoFocus
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid rgba(255,138,138,0.4)',
                borderRadius: 8, padding: '14px 16px', color: 'var(--accent-coral)',
                ...M, fontSize: 22, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
              }}
            />

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              NOTE (optional)
            </label>
            <input
              type="text"
              value={sendBranchNote}
              onChange={e => setSendBranchNote(e.target.value)}
              placeholder="e.g. to CTS, to Banaue..."
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />

            {sendBranchError && (
              <div style={{ ...M, fontSize: 11, color: 'var(--accent-coral)', marginTop: 12 }}>✗ {sendBranchError}</div>
            )}

            <button
              data-testid="send-branch-confirm"
              onClick={handleSendBranch}
              disabled={sendBranchLoading || !sendBranchInput.value}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none', marginTop: 20,
                background: sendBranchLoading || !sendBranchInput.value ? 'var(--border-subtle)' : 'linear-gradient(135deg,#ff8a8a,#c95a5a)',
                color: sendBranchLoading || !sendBranchInput.value ? 'var(--text-muted)' : '#fff',
                ...Y, fontSize: 14, fontWeight: 800, cursor: sendBranchLoading || !sendBranchInput.value ? 'not-allowed' : 'pointer',
              }}
            >
              {sendBranchLoading ? 'SAVING...' : 'SEND TO BRANCH'}
            </button>
          </div>
        </div>
      )}

      {/* ── TO KEN MODAL (treasurer only) — drawer → Peso Ken ── */}
      {showToKenModal && shift && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ ...M, fontSize: 10, color: 'var(--accent-coral)', letterSpacing: '0.2em', marginBottom: 4 }}>RETURN TO PESO KEN</div>
                <div style={{ ...Y, fontSize: 20, fontWeight: 800 }}>Drawer → Ken&apos;s Float</div>
              </div>
              <button onClick={() => setShowToKenModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {(shift.inter_branch_outflows?.filter(o => o.destination === 'PESO_KEN').length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                {shift.inter_branch_outflows!.filter(o => o.destination === 'PESO_KEN').map(o => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>{o.note || 'Return to Ken'}</span>
                    <span style={{ ...M, fontSize: 12, color: 'var(--accent-coral)' }}>−{php(o.amount_php)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 2 }}>
                  <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>TOTAL RETURNED</span>
                  <span style={{ ...M, fontSize: 12, color: 'var(--accent-coral)', fontWeight: 700 }}>−{php(shift.peso_ken_out_php ?? 0)}</span>
                </div>
              </div>
            )}

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              AMOUNT (PHP)
            </label>
            <input
              type="text" inputMode="decimal"
              ref={toKenInput.ref}
              value={toKenInput.value}
              onChange={toKenInput.onChange}
              onFocus={toKenInput.onFocus}
              placeholder="0.00" autoFocus
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid rgba(255,138,138,0.4)',
                borderRadius: 8, padding: '14px 16px', color: 'var(--accent-coral)',
                ...M, fontSize: 22, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
              }}
            />

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              NOTE (optional)
            </label>
            <input
              type="text"
              value={toKenNote}
              onChange={e => setToKenNote(e.target.value)}
              placeholder="e.g. returning float, end of day..."
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />

            {toKenError && (
              <div style={{ ...M, fontSize: 11, color: 'var(--accent-coral)', marginTop: 12 }}>✗ {toKenError}</div>
            )}

            <button
              data-testid="to-ken-confirm"
              onClick={handleToKen}
              disabled={toKenLoading || !toKenInput.value}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none', marginTop: 20,
                background: toKenLoading || !toKenInput.value ? 'var(--border-subtle)' : 'linear-gradient(135deg,#ff8a8a,#c95a5a)',
                color: toKenLoading || !toKenInput.value ? 'var(--text-muted)' : '#fff',
                ...Y, fontSize: 14, fontWeight: 800, cursor: toKenLoading || !toKenInput.value ? 'not-allowed' : 'pointer',
              }}
            >
              {toKenLoading ? 'SAVING...' : 'RETURN TO KEN'}
            </button>
          </div>
        </div>
      )}

      {/* ── TO VALE MODAL (treasurer only) — drawer → investor (paying back IOU) ── */}
      {showToValeModal && shift && (
        <div style={overlayStyle}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ ...M, fontSize: 10, color: 'var(--accent-coral)', letterSpacing: '0.2em', marginBottom: 4 }}>RETURN TO VALE</div>
                <div style={{ ...Y, fontSize: 20, fontWeight: 800 }}>Drawer → Investor</div>
              </div>
              <button onClick={() => setShowToValeModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {(shift.inter_branch_outflows?.filter(o => o.destination === 'VALE').length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                {shift.inter_branch_outflows!.filter(o => o.destination === 'VALE').map(o => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>{o.note || 'Return to vale'}</span>
                    <span style={{ ...M, fontSize: 12, color: 'var(--accent-coral)' }}>−{php(o.amount_php)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 2 }}>
                  <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>TOTAL RETURNED</span>
                  <span style={{ ...M, fontSize: 12, color: 'var(--accent-coral)', fontWeight: 700 }}>−{php(shift.vale_out_php ?? 0)}</span>
                </div>
              </div>
            )}

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              VALE PARTY (INVESTOR)
            </label>
            <select
              value={toValePartyId}
              onChange={e => setToValePartyId(e.target.value)}
              data-testid="to-vale-party"
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
              }}
            >
              <option value="">— pick party —</option>
              {valeParties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              AMOUNT (PHP)
            </label>
            <input
              type="text" inputMode="decimal"
              ref={toValeInput.ref}
              value={toValeInput.value}
              onChange={toValeInput.onChange}
              onFocus={toValeInput.onFocus}
              placeholder="0.00" autoFocus
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid rgba(255,138,138,0.4)',
                borderRadius: 8, padding: '14px 16px', color: 'var(--accent-coral)',
                ...M, fontSize: 22, outline: 'none', boxSizing: 'border-box', marginBottom: 12,
              }}
            />

            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
              NOTE (optional)
            </label>
            <input
              type="text"
              value={toValeNote}
              onChange={e => setToValeNote(e.target.value)}
              placeholder="e.g. partial repayment, full settle..."
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />

            {toValeError && (
              <div style={{ ...M, fontSize: 11, color: 'var(--accent-coral)', marginTop: 12 }}>✗ {toValeError}</div>
            )}

            <button
              data-testid="to-vale-confirm"
              onClick={handleToVale}
              disabled={toValeLoading || !toValeInput.value || !toValePartyId}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none', marginTop: 20,
                background: toValeLoading || !toValeInput.value || !toValePartyId ? 'var(--border-subtle)' : 'linear-gradient(135deg,#ff8a8a,#c95a5a)',
                color: toValeLoading || !toValeInput.value || !toValePartyId ? 'var(--text-muted)' : '#fff',
                ...Y, fontSize: 14, fontWeight: 800, cursor: toValeLoading || !toValeInput.value || !toValePartyId ? 'not-allowed' : 'pointer',
              }}
            >
              {toValeLoading ? 'SAVING...' : 'RETURN TO VALE'}
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
                <div style={{ ...M, fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.2em', marginBottom: 4 }}>
                  END SHIFT
                </div>
                <div style={{ ...Y, fontSize: 20, fontWeight: 800 }}>Close Your Shift</div>
              </div>
              <button onClick={() => { setShowEndModal(false); setShiftError(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>
                ✕
              </button>
            </div>

            {/* ── 2-card peso bookend (treasurer only) ─────────────────── */}
            {(shift.is_treasurer_shift ?? false) && (() => {
              const expectedNow = (shift.opening_cash_php ?? 0)
                + (shift.from_dispatches_php  ?? 0)
                - (shift.dispatches_out_php   ?? 0)
                + (shift.from_cashier_php     ?? 0)
                + (shift.bale_peso_php        ?? 0)
                + (shift.inter_branch_in_php  ?? 0)
                - (shift.inter_branch_out_php ?? 0)
                + (shift.peso_ken_in_php      ?? 0)
                - (shift.peso_ken_out_php     ?? 0)
                - (shift.vault_returns_php    ?? 0)
                + (shift.cheques_cleared_php  ?? 0)
                - (shift.expenses_php         ?? 0);
              return (
                <div data-testid="treasurer-peso-bookend" style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18,
                }}>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 4 }}>OPENING PESO</div>
                    <div style={{ ...Y, fontSize: 18, fontWeight: 800, color: 'var(--text-strong)' }}>{php(shift.opening_cash_php ?? 0)}</div>
                  </div>
                  <div style={{ background: 'rgba(61,199,173,0.08)', border: '1px solid rgba(61,199,173,0.3)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ ...M, fontSize: 9, color: 'var(--teal-300)', letterSpacing: '0.15em', marginBottom: 4 }}>EXPECTED CLOSING PESO</div>
                    <div style={{ ...Y, fontSize: 18, fontWeight: 800, color: 'var(--teal-300)' }}>{php(expectedNow)}</div>
                  </div>
                </div>
              );
            })()}

            {/* Shift summary so far */}
            {(() => {
              const isTreasurer = shift.is_treasurer_shift ?? false;
              let rows: [string, string, string?][];
              if (isTreasurer) {
                const overallBought = shift.overall_total_bought_php ?? 0;
                const overallSold   = shift.overall_total_sold_php   ?? 0;
                const bale          = shift.bale_peso_php            ?? 0;
                const interBranch   = shift.inter_branch_in_php      ?? 0;
                const interBranchOut = shift.inter_branch_out_php    ?? 0;
                const pesoKenIn     = shift.peso_ken_in_php          ?? 0;
                const pesoKenOut    = shift.peso_ken_out_php         ?? 0;
                const vaultReturns  = shift.vault_returns_php        ?? 0;
                const expenses      = shift.expenses_php             ?? 0;
                const cheques       = shift.cheques_cleared_php      ?? 0;
                rows = [
                  ['Total Bought (overall)',     php(overallBought),               'var(--accent-sky)'],
                  ['Total Sold (overall)',       php(overallSold),                 'var(--accent-gold)'],
                  ['Difference (overall)',       php(overallSold - overallBought), 'var(--text-strong)'],
                  ['Dispatched Out',             '-' + php(shift.dispatches_out_php ?? 0), 'var(--accent-coral)'],
                  ['Remitted In (riders)',       '+' + php(shift.from_dispatches_php ?? 0), 'var(--teal-300)'],
                  ['From Cashier',               '+' + php(shift.from_cashier_php    ?? 0), 'var(--teal-300)'],
                  ['Bale Peso (vault → drawer)', '+' + php(bale),                  'var(--teal-300)'],
                  ...(interBranch > 0 ? [['From Branch (inter-branch in)', '+' + php(interBranch), 'var(--teal-300)']] as [string, string, string?][] : []),
                  ...(interBranchOut > 0 ? [['To Branch (inter-branch out)', '-' + php(interBranchOut), 'var(--accent-coral)']] as [string, string, string?][] : []),
                  ...(pesoKenIn > 0 ? [['From Ken (Ken float → drawer)', '+' + php(pesoKenIn), 'var(--teal-300)']] as [string, string, string?][] : []),
                  ...(pesoKenOut > 0 ? [['To Ken (drawer → Ken float)', '-' + php(pesoKenOut), 'var(--accent-coral)']] as [string, string, string?][] : []),
                  ...(vaultReturns !== 0 ? [['Vault Movement (drawer ↔ vault)', (vaultReturns >= 0 ? '-' : '+') + php(Math.abs(vaultReturns)), vaultReturns >= 0 ? 'var(--accent-coral)' : 'var(--teal-300)']] as [string, string, string?][] : []),
                  ...(cheques > 0      ? [['Cheques Cleared', '+' + php(cheques), 'var(--teal-300)']]      as [string, string, string?][] : []),
                  ...(expenses > 0     ? [['Expenses',        '-' + php(expenses), 'var(--accent-coral)']] as [string, string, string?][] : []),
                  ['Opening Cash',               php(shift.opening_cash_php)],
                ];
              } else {
                const comm      = shift.total_commission ?? totalCommission;
                const boughtRaw = shift.total_bought_php ?? myTxns.filter(t=>t.type==='BUY').reduce((s,t)=>s+t.phpAmt,0);
                rows = [
                  ['Transactions',       String(shift.txn_count ?? myTxns.length)],
                  ['Total Sold (PHP)',   php(shift.total_sold_php ?? myTxns.filter(t=>t.type==='SELL').reduce((s,t)=>s+t.phpAmt,0))],
                  ['Total Bought (PHP)', php(boughtRaw + comm)],
                  ['Replenishment',      '+' + php(shift.total_replenishment_php ?? 0), 'var(--teal-300)'],
                  ['Petty Cash',         '-' + php(shift.total_petty_cash_php ?? 0), 'var(--accent-coral)'],
                  ['Opening Cash',       php(shift.opening_cash_php)],
                ];
              }
              return rows.map(([k, v, color]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '7px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ ...M, fontSize: 12, color: color ?? 'var(--text-strong)' }}>{v}</span>
                </div>
              ));
            })()}

            {/* Per-currency breakdown */}
            {(() => {
              const byCcy: Record<string, { buyQty: number; buyPhp: number; sellQty: number; sellPhp: number }> = {};
              for (const t of myTxns) {
                if (!byCcy[t.currency]) byCcy[t.currency] = { buyQty: 0, buyPhp: 0, sellQty: 0, sellPhp: 0 };
                if (t.type === 'BUY') { byCcy[t.currency].buyQty += t.foreignAmt; byCcy[t.currency].buyPhp += t.phpAmt; }
                else                  { byCcy[t.currency].sellQty += t.foreignAmt; byCcy[t.currency].sellPhp += t.phpAmt; }
              }
              const entries = Object.entries(byCcy);
              if (entries.length === 0) return null;
              return (
                <div style={{ marginTop: 12, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                    <span>CCY</span>
                    <span style={{ textAlign: 'right' }}>BUY QTY</span>
                    <span style={{ textAlign: 'right' }}>BUY PHP</span>
                    <span style={{ textAlign: 'right' }}>SELL QTY</span>
                    <span style={{ textAlign: 'right' }}>SELL PHP</span>
                  </div>
                  {entries.map(([code, d], i) => (
                    <div key={code} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr 1fr', padding: '7px 10px', borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                      <span style={{ ...M, fontSize: 11, fontWeight: 700, color: 'var(--text-strong)' }}>{code}</span>
                      <span style={{ ...M, fontSize: 10, color: d.buyQty > 0 ? 'var(--accent-sky)' : 'var(--text-muted)', textAlign: 'right' }}>{d.buyQty > 0 ? fmtFx(d.buyQty, code, currencies) : '—'}</span>
                      <span style={{ ...M, fontSize: 10, color: d.buyPhp > 0 ? 'var(--accent-sky)' : 'var(--text-muted)', textAlign: 'right' }}>{d.buyPhp > 0 ? php(d.buyPhp) : '—'}</span>
                      <span style={{ ...M, fontSize: 10, color: d.sellQty > 0 ? 'var(--accent-gold)' : 'var(--text-muted)', textAlign: 'right' }}>{d.sellQty > 0 ? fmtFx(d.sellQty, code, currencies) : '—'}</span>
                      <span style={{ ...M, fontSize: 10, color: d.sellPhp > 0 ? 'var(--accent-gold)' : 'var(--text-muted)', textAlign: 'right' }}>{d.sellPhp > 0 ? php(d.sellPhp) : '—'}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Expected closing cash — actor compares this against their physical count */}
            {(() => {
              const isTreasurer = shift.is_treasurer_shift ?? false;
              let expected: number;
              if (isTreasurer) {
                expected = (shift.opening_cash_php ?? 0)
                  + (shift.from_dispatches_php  ?? 0)
                  - (shift.dispatches_out_php   ?? 0)
                  + (shift.from_cashier_php     ?? 0)
                  + (shift.bale_peso_php        ?? 0)
                  + (shift.inter_branch_in_php  ?? 0)
                  - (shift.inter_branch_out_php ?? 0)
                  - (shift.vault_returns_php    ?? 0)
                  + (shift.cheques_cleared_php  ?? 0)
                  - (shift.expenses_php         ?? 0);
              } else {
                const comm      = shift.total_commission ?? totalCommission;
                const repl      = shift.total_replenishment_php ?? 0;
                const petty     = shift.total_petty_cash_php ?? 0;
                const soldAmt   = shift.total_sold_php   ?? myTxns.filter(t=>t.type==='SELL').reduce((s,t)=>s+t.phpAmt,0);
                const boughtAmt = shift.total_bought_php ?? myTxns.filter(t=>t.type==='BUY').reduce((s,t)=>s+t.phpAmt,0);
                expected  = (shift.opening_cash_php ?? 0) + soldAmt - boughtAmt - comm + repl - petty;
              }
              return (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', marginTop: 12, borderRadius: 8,
                  background: 'rgba(212,166,74,0.08)', border: '1px solid rgba(212,166,74,0.3)',
                }}>
                  <span style={{ ...M, fontSize: 11, color: 'var(--accent-gold)', letterSpacing: '0.1em' }}>EXPECTED CASH</span>
                  <span style={{ ...Y, fontSize: 18, fontWeight: 800, color: 'var(--accent-gold)' }}>{php(expected)}</span>
                </div>
              );
            })()}

            <div style={{ marginTop: 16 }}>
              <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
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
                  width: '100%', background: 'var(--bg)', border: '1px solid rgba(212,166,74,0.4)',
                  borderRadius: 8, padding: '14px 16px', color: 'var(--accent-gold)',
                  ...M, fontSize: 22, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {shiftError && (
              <div style={{ ...M, fontSize: 11, color: 'var(--accent-coral)', marginTop: 12 }}>✗ {shiftError}</div>
            )}

            <button
              onClick={handleCloseShift}
              disabled={shiftLoading || !closingCashInput.value}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none', marginTop: 20,
                background: shiftLoading || !closingCashInput.value ? 'var(--border-subtle)' : 'linear-gradient(135deg,#f5a623,#e09000)',
                color: shiftLoading || !closingCashInput.value ? 'var(--text-muted)' : '#000',
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
            setCustId(null);  // scanner = free-text path; admin can link in merge UI later
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
                <div style={{ ...M, fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.2em', marginBottom: 4 }}>
                  {role === 'admin' ? 'EDIT TRANSACTION' : 'REQUEST EDIT'}
                </div>
                <div style={{ ...Y, fontSize: 18, fontWeight: 800 }}>{editTxn.id}</div>
                <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {editTxn.type} · {editTxn.currency} · {editTxn.time}
                </div>
              </div>
              <button onClick={() => { setEditTxn(null); setEditDraft(null); setEditError(null); setEditSent(false); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>
                ✕
              </button>
            </div>

            {editSent ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                <div style={{ ...Y, fontSize: 16, fontWeight: 800, color: 'var(--accent-gold)', marginBottom: 8 }}>Request Submitted</div>
                <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)', marginBottom: 24 }}>
                  Waiting for admin approval. The transaction will update once approved.
                </div>
                <button
                  onClick={() => { setEditTxn(null); setEditDraft(null); setEditSent(false); }}
                  style={{ padding: '10px 28px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', ...M, fontSize: 12, cursor: 'pointer' }}
                >Close</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {role !== 'admin' && (
                  <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', background: 'rgba(212,166,74,0.07)', border: '1px solid rgba(212,166,74,0.2)', borderRadius: 8, padding: '8px 14px' }}>
                    Changes won&apos;t apply until admin approves.
                  </div>
                )}

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>CUSTOMER</label>
                  <input
                    type="text"
                    value={editDraft.customer}
                    onChange={e => setEditDraft({ ...editDraft, customer: e.target.value })}
                    placeholder="Name or reference"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>REFERRER <span style={{ opacity: 0.45 }}>(optional)</span></label>
                  <input
                    type="text"
                    value={editDraft.referrer}
                    onChange={e => setEditDraft({ ...editDraft, referrer: e.target.value })}
                    placeholder="Tour guide or referral source"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>PAYMENT MODE</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {PAY_MODES.map(m => (
                      <button key={m} type="button" onClick={() => { setEditDraft({ ...editDraft, payment_mode: m }); if (!NEEDS_BANK.includes(m as PayMode)) setEditBankId(null); }} style={{
                        padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${editDraft.payment_mode === m ? 'rgba(61,199,173,0.5)' : 'var(--border-subtle)'}`,
                        background: editDraft.payment_mode === m ? 'rgba(61,199,173,0.1)' : 'transparent',
                        color: editDraft.payment_mode === m ? 'var(--teal-300)' : 'var(--text-muted)',
                        ...M, fontSize: 10,
                      }}>{m.replace('_', ' ')}</button>
                    ))}
                  </div>
                  {NEEDS_BANK.includes(editDraft.payment_mode as PayMode) && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>BANK</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {banks.map(b => (
                          <button key={b.id} type="button" onClick={() => setEditBankId(b.id)} style={{
                            padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                            border: `1px solid ${editBankId === b.id ? 'rgba(95,183,212,0.5)' : 'var(--border-subtle)'}`,
                            background: editBankId === b.id ? 'rgba(95,183,212,0.1)' : 'transparent',
                            color: editBankId === b.id ? 'var(--accent-sky)' : 'var(--text-muted)',
                            ...M, fontSize: 10,
                          }}>{b.code}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
                  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4,
                }}>
                  {(['BUY', 'SELL'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setEditDraft({ ...editDraft, type: t })} style={{
                      padding: '10px', border: '1px solid',
                      borderColor: editDraft.type === t ? (t === 'BUY' ? 'rgba(95,183,212,0.45)' : 'rgba(212,166,74,0.45)') : 'transparent',
                      borderRadius: 9, cursor: 'pointer',
                      background: editDraft.type === t ? (t === 'BUY' ? 'rgba(95,183,212,0.14)' : 'rgba(212,166,74,0.14)') : 'transparent',
                      color: editDraft.type === t ? (t === 'BUY' ? 'var(--accent-sky)' : 'var(--accent-gold)') : 'var(--text-muted)',
                      ...M, fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', transition: 'all 0.15s',
                    }}>
                      {t === 'BUY' ? '↓ BUY' : '↑ SELL'}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>FOREIGN AMOUNT</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editDraft.foreign_amt}
                      onChange={e => setEditDraft({ ...editDraft, foreign_amt: e.target.value })}
                      style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)', ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>RATE</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editDraft.rate}
                      onChange={e => setEditDraft({ ...editDraft, rate: e.target.value })}
                      style={{ width: '100%', background: 'var(--bg)', border: `1px solid ${editDraft.type === 'BUY' ? 'rgba(95,183,212,0.4)' : 'rgba(212,166,74,0.4)'}`, borderRadius: 8, padding: '10px 14px', color: editDraft.type === 'BUY' ? 'var(--accent-sky)' : 'var(--accent-gold)', ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                    GUIDE RATE <span style={{ opacity: 0.45 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editDraft.official_rate}
                    onChange={e => setEditDraft({ ...editDraft, official_rate: e.target.value })}
                    placeholder="e.g. 56.50"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)', ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {(() => {
                  const r = parseFloat(editDraft.rate);
                  const a = parseFloat(editDraft.foreign_amt);
                  const preview = !isNaN(r) && !isNaN(a) && r > 0 && a > 0 ? r * a : null;
                  return preview != null ? (
                    <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>
                      PHP preview: <span style={{ color: 'var(--teal-300)' }}>{php(preview)}</span>
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
                      background: comm > 0 ? 'rgba(61,199,173,0.05)' : 'rgba(238,108,90,0.05)',
                      border: `1px solid ${comm > 0 ? 'rgba(61,199,173,0.2)' : 'rgba(238,108,90,0.2)'}`,
                      borderRadius: 10, padding: '10px 14px',
                    }}>
                      <div style={{ ...M, fontSize: 9, color: comm > 0 ? 'var(--teal-300)' : 'var(--accent-coral)', letterSpacing: '0.12em', marginBottom: 6 }}>
                        COMMISSION PREVIEW
                      </div>
                      <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                        Guide rate: <span style={{ color: 'var(--text-strong)' }}>{offRate}</span>
                      </div>
                      <div style={{ ...M, fontSize: 12, color: comm > 0 ? 'var(--teal-300)' : 'var(--accent-coral)' }}>
                        Total: {php(Math.abs(comm))}
                        {editDraft.referrer && <> · You: {php(Math.abs(cashierCut))} · {editDraft.referrer}: {php(Math.abs(refCut))}</>}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                    REASON <span style={{ opacity: 0.45 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editDraft.note}
                    onChange={e => setEditDraft({ ...editDraft, note: e.target.value })}
                    placeholder="e.g. wrong rate entered"
                    style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)', ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {editError && (
                  <div style={{ ...M, fontSize: 11, color: 'var(--accent-coral)', background: 'rgba(238,108,90,0.08)', border: '1px solid rgba(238,108,90,0.2)', borderRadius: 8, padding: '8px 14px' }}>
                    ✗ {editError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={() => { setEditTxn(null); setEditDraft(null); setEditError(null); }}
                    style={{ padding: '12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', ...M, fontSize: 12, cursor: 'pointer' }}
                  >Cancel</button>
                  <button
                    onClick={role === 'admin' ? handleAdminEdit : handleEditRequest}
                    disabled={editLoading}
                    data-testid="edit-submit-btn"
                    style={{ padding: '12px', borderRadius: 8, border: 'none', background: editLoading ? 'var(--border-subtle)' : 'linear-gradient(135deg,#f5a623,#e09000)', color: editLoading ? 'var(--text-muted)' : '#000', ...Y, fontSize: 13, fontWeight: 800, cursor: editLoading ? 'not-allowed' : 'pointer' }}
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
            <div style={{ ...M, fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.2em', marginBottom: 8 }}>
              SETUP REQUIRED
            </div>
            <div style={{ ...Y, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              Rates Not Set Yet
            </div>
            <div style={{ ...M, fontSize: 12, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.7 }}>
              Today&apos;s buy/sell rates haven&apos;t been set. You cannot process transactions until admin sets them. Ask your admin or supervisor to go to{' '}
              <span style={{ color: 'var(--teal-300)' }}>/admin/rates</span> and set today&apos;s rates.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: '1px solid rgba(212,166,74,0.3)',
                background: 'rgba(212,166,74,0.08)', color: 'var(--accent-gold)',
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
          background: 'rgba(212,166,74,0.06)', borderBottom: '1px solid rgba(212,166,74,0.2)',
          padding: `10px ${px}px`, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 14 }}>ℹ️</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-gold)' }}>
            Rates set for {ratesCount} of {currencies.length} currencies today. Currencies without rates require manual rate entry.
          </span>
        </div>
      )}

      {/* ── NAV ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `0 ${px}px`, height: '60px', borderBottom: '1px solid var(--border-subtle)',
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
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>Kedco <span style={{ color: 'var(--teal-300)' }}>FX</span></div>
            <div style={{ ...M, fontSize: 9, color: 'var(--text-faint)', marginTop: -1 }}>Counter · {terminal || 'Set device'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
          {!isMobile && (
            <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-strong)' }}>{username}</span>
            </div>
          )}
          {shift && (<>
            <button
              onClick={() => { setReplenishError(null); replenishInput.setValue(''); setReplenishNote(''); setShowReplenishModal(true); }}
              style={{
                padding: '5px 10px', borderRadius: 6,
                border: '1px solid rgba(61,199,173,0.35)',
                background: 'rgba(61,199,173,0.07)',
                color: 'var(--teal-300)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
              }}
            >
              REPL
            </button>
            {role === 'supervisor' && (
              <button
                data-testid="send-branch-btn"
                onClick={() => { setSendBranchError(null); sendBranchInput.setValue(''); setSendBranchNote(''); setShowSendBranchModal(true); }}
                style={{
                  padding: '5px 10px', borderRadius: 6,
                  border: '1px solid rgba(255,138,138,0.35)',
                  background: 'rgba(255,138,138,0.07)',
                  color: 'var(--accent-coral)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
                }}
              >
                SEND
              </button>
            )}
            {role === 'supervisor' && (
              <button
                data-testid="to-ken-btn"
                onClick={() => { setToKenError(null); toKenInput.setValue(''); setToKenNote(''); setShowToKenModal(true); }}
                style={{
                  padding: '5px 10px', borderRadius: 6,
                  border: '1px solid rgba(255,138,138,0.35)',
                  background: 'rgba(255,138,138,0.07)',
                  color: 'var(--accent-coral)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
                }}
              >
                TO KEN
              </button>
            )}
            {role === 'supervisor' && (
              <button
                data-testid="to-vale-btn"
                onClick={() => { setToValeError(null); toValeInput.setValue(''); setToValeNote(''); setToValePartyId(''); setShowToValeModal(true); }}
                style={{
                  padding: '5px 10px', borderRadius: 6,
                  border: '1px solid rgba(255,138,138,0.35)',
                  background: 'rgba(255,138,138,0.07)',
                  color: 'var(--accent-coral)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
                }}
              >
                TO VALE
              </button>
            )}
            <button
              onClick={async () => {
                setShiftError(null);
                // Refetch shift so totals (sold, bought, expected) are current, not stale from page load
                try {
                  const r = await fetch('/api/counter/shift', { cache: 'no-store' });
                  if (r.ok) { const d = await r.json(); if (d.status === 'OPEN') setShift(d); }
                } catch { /* show modal anyway with what we have */ }
                setShowEndModal(true);
              }}
              style={{
                padding: '5px 14px', borderRadius: 6,
                border: '1px solid rgba(212,166,74,0.4)',
                background: 'rgba(212,166,74,0.08)',
                color: 'var(--accent-gold)', ...M, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
              }}
            >
              END SHIFT
            </button>
          </>)}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="MENU"
              aria-expanded={menuOpen}
              style={{
                padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--border-subtle)', background: 'transparent',
                color: 'var(--text-muted)', ...M, fontSize: 12, cursor: 'pointer',
                letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>☰</span> MENU
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 220,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 6, zIndex: 150,
                boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                display: 'flex', flexDirection: 'column',
              }}>
                {role === 'admin' && (<>
                  <a href="/"      onClick={() => setMenuOpen(false)} style={menuItemStyle}>Dashboard</a>
                  <a href="/admin" onClick={() => setMenuOpen(false)} style={menuItemStyle}>Admin</a>
                  <div style={menuDivider} />
                </>)}
                {role === 'supervisor' && (<>
                  <a href="/supervisor"              onClick={() => setMenuOpen(false)} style={{ ...menuItemStyle, color: 'var(--teal-300)' }}>← Supervisor Hub</a>
                  <a href="/supervisor/transactions" onClick={() => setMenuOpen(false)} style={menuItemStyle}>Cashier Txns</a>
                  <a href="/admin/riders"            onClick={() => setMenuOpen(false)} style={menuItemStyle}>Riders</a>
                  <a href="/admin/vales"             onClick={() => setMenuOpen(false)} style={menuItemStyle}>Vale Ledger</a>
                  <div style={menuDivider} />
                </>)}
                <a href="/passbook" onClick={() => setMenuOpen(false)} style={menuItemStyle}>Passbook</a>
                <div style={menuDivider} />
                <button
                  onClick={() => { setMenuOpen(false); setBranchDraft(branch); setTerminalDraft(terminal); setDeviceStep(1); setShowDeviceModal(true); }}
                  style={{ ...menuItemStyle, textAlign: 'left', background: 'transparent', cursor: 'pointer', width: '100%' }}
                >
                  {branch ? `${branch} · ${terminal || '?'}` : 'Set device'}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  style={{ ...menuItemStyle, textAlign: 'left', background: 'transparent', cursor: 'pointer', width: '100%', color: 'var(--text-muted)' }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── BODY ── */}
      <div style={{
        padding: `24px ${px}px`,
        display: 'grid',
        gridTemplateColumns: isMobile || isTablet ? '1fr' : '400px 1fr',
        gap: 24,
        maxWidth: 1600,
        margin: '0 auto',
        width: '100%',
      }}>

        {/* ── LEFT: FORM ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header */}
          <div>
            <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.2em', marginBottom: 2 }}>
              NEW TRANSACTION
            </div>
            <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)' }}>{today.toUpperCase()}</div>
          </div>

          {/* BUY / SELL toggle */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4,
          }}>
            {(['BUY', 'SELL'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '14px', border: '1px solid',
                  borderColor: type === t
                    ? (t === 'BUY' ? 'rgba(95,183,212,0.45)' : 'rgba(212,166,74,0.45)')
                    : 'transparent',
                  borderRadius: 9, cursor: 'pointer',
                  background: type === t
                    ? (t === 'BUY' ? 'rgba(95,183,212,0.14)' : 'rgba(212,166,74,0.14)')
                    : 'transparent',
                  color: type === t
                    ? (t === 'BUY' ? 'var(--accent-sky)' : 'var(--accent-gold)')
                    : 'var(--text-muted)',
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
            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
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
                width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px', boxSizing: 'border-box',
                color: ccy && !ccyOpen ? 'var(--text-strong)' : 'var(--text-muted)',
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
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, marginTop: 4,
                  maxHeight: 220, overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  {filtered.length === 0 && (
                    <div style={{ ...M, fontSize: 12, color: 'var(--text-muted)', padding: '10px 14px' }}>
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
                      <span style={{ ...M, fontSize: 13, color: 'var(--text-strong)', fontWeight: 700 }}>{c.code}</span>
                      <span style={{ ...M, fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>{c.name}</span>
                      {!c.rateSet && <span style={{ ...M, fontSize: 10, color: 'var(--accent-coral)' }}>no rate</span>}
                    </div>
                  ))}
                </div>
              );
            })()}
            {ccy?.rateSet && (
              <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                Rate board — B: <span style={{ color: 'var(--accent-sky)' }}>
                  {ccy.todayBuyRate?.toFixed(ccy.decimalPlaces)}
                </span>
                &nbsp;·&nbsp;S: <span style={{ color: 'var(--accent-gold)' }}>
                  {ccy.todaySellRate?.toFixed(ccy.decimalPlaces)}
                </span>
              </div>
            )}
            {ccy && !ccy.rateSet && (
              <div style={{ ...M, fontSize: 10, color: 'var(--accent-gold)', marginTop: 6 }}>
                No rate set for today — enter the rate manually below.
              </div>
            )}
          </div>

          {/* Foreign Amount */}
          <div>
            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
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
                width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '12px 14px', color: 'var(--text-strong)',
                ...M, fontSize: 20, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Rate */}
          <div>
            <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
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
                width: '100%', background: 'var(--bg-card)', border: `1px solid ${typeColor}44`,
                borderRadius: 8, padding: '12px 14px', color: typeColor,
                ...M, fontSize: 16, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Guide Rate — cashier/admin only */}
          {role !== 'supervisor' && (
            <div>
              <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>
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
                  width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', color: 'var(--text-muted)',
                  ...M, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* PHP Total */}
          <div style={{
            background: 'var(--bg-card)',
            border: `1px solid ${phpTotal != null ? 'rgba(61,199,173,0.35)' : 'var(--border-subtle)'}`,
            borderRadius: 12, padding: '18px 20px', transition: 'border-color 0.2s',
          }}>
            <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 8 }}>
              PHP TOTAL
            </div>
            <div style={{ ...Y, fontSize: 34, fontWeight: 800, color: phpTotal != null ? 'var(--teal-300)' : 'var(--text-muted)' }}>
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
                background: commission > 0 ? 'rgba(61,199,173,0.05)' : 'rgba(238,108,90,0.05)',
                border: `1px solid ${commission > 0 ? 'rgba(61,199,173,0.2)' : 'rgba(238,108,90,0.2)'}`,
                borderRadius: 10, padding: '10px 14px',
              }}>
                <div style={{ ...M, fontSize: 9, color: commission > 0 ? 'var(--teal-300)' : 'var(--accent-coral)', letterSpacing: '0.12em', marginBottom: 6 }}>
                  COMMISSION PREVIEW
                </div>
                <div style={{ ...M, fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                  Spread: <span style={{ color: 'var(--text-strong)' }}>{commission > 0 ? '+' : '-'}{php(Math.abs(commission / +amtInput.raw))}</span> per unit
                </div>
                <div style={{ ...M, fontSize: 12, color: commission > 0 ? 'var(--teal-300)' : 'var(--accent-coral)' }}>
                  Total: {php(Math.abs(commission))}
                  {referrer && <> · You: {php(Math.abs(cashierCut))} · {referrer}: {php(Math.abs(refCut))}</>}
                </div>
              </div>
            );
          })()}

          {/* Customer / AMLA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
                CUSTOMER / AMLA <span style={{ opacity: 0.45 }}>(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setScanning(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 6,
                  border: '1px solid rgba(61,199,173,0.4)',
                  background: 'rgba(61,199,173,0.07)',
                  color: 'var(--teal-300)', ...M, fontSize: 10, cursor: 'pointer',
                }}
              >
                📷 Scan ID
              </button>
            </div>
            <CustomerPicker
              value={cust}
              customerId={custId}
              onChange={(name, id) => { setCust(name); setCustId(id); }}
              placeholder="Name or reference"
              variant="counter"
            />
            <input
              type="text"
              value={idNumber}
              onChange={e => setIdNumber(e.target.value)}
              placeholder="ID number (PhilSys / DL / Passport)"
              style={{
                width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
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
                  width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
                  ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* Supervisor: reference date + advance/late tag */}
          {role === 'supervisor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
                PAYMENT DATE <span style={{ opacity: 0.45 }}>(reference)</span>
              </label>
              <input
                type="date"
                value={referenceDate}
                onChange={e => setReferenceDate(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', color: 'var(--text-strong)',
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
                      border: `1px solid ${paymentTag === tag ? 'rgba(61,199,173,0.5)' : 'var(--border-subtle)'}`,
                      background: paymentTag === tag ? 'rgba(61,199,173,0.1)' : 'transparent',
                      color: paymentTag === tag ? 'var(--teal-300)' : 'var(--text-muted)',
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
                PAYMENT MODE
              </label>
              <button
                type="button"
                data-testid="split-toggle"
                onClick={() => setSplitMode(v => !v)}
                style={{
                  padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                  border: `1px solid ${splitMode ? 'rgba(61,199,173,0.5)' : 'var(--border-subtle)'}`,
                  background: splitMode ? 'rgba(61,199,173,0.1)' : 'transparent',
                  color: splitMode ? 'var(--teal-300)' : 'var(--text-muted)',
                  ...M, fontSize: 9, letterSpacing: '0.08em',
                }}
              >
                {splitMode ? 'SPLIT ON' : '+ SPLIT'}
              </button>
            </div>

            {!splitMode ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PAY_MODES.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMode(m)}
                      style={{
                        padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${payMode === m ? 'rgba(61,199,173,0.5)' : 'var(--border-subtle)'}`,
                        background: payMode === m ? 'rgba(61,199,173,0.1)' : 'transparent',
                        color: payMode === m ? 'var(--teal-300)' : 'var(--text-muted)',
                        ...M, fontSize: 10, letterSpacing: '0.05em',
                      }}
                    >
                      {m.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                {NEEDS_BANK.includes(payMode) && (
                  <div style={{ marginTop: 10 }}>
                    <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                      {payMode === 'CHEQUE' ? 'BANK (CHEQUE)' : 'BANK'}
                    </label>
                    <select
                      value={bankId ?? ''}
                      onChange={e => setBankId(e.target.value ? +e.target.value : null)}
                      style={{
                        width: '100%', background: 'var(--bg-card)',
                        border: `1px solid ${bankId ? 'rgba(61,199,173,0.4)' : '#ff5c5c44'}`,
                        borderRadius: 8, padding: '10px 14px', boxSizing: 'border-box',
                        color: bankId ? 'var(--text-strong)' : 'var(--text-muted)',
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
              </>
            ) : (
              <div data-testid="slice-builder" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slices.map((s, i) => {
                  const refRequired = ['GCASH', 'MAYA', 'SHOPEEPAY'].includes(s.method);
                  return (
                    <div key={i} data-testid={`slice-row-${i}`} style={{
                      border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 10,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                          SLICE {i + 1}
                        </span>
                        {slices.length > 2 && (
                          <button
                            type="button"
                            data-testid={`slice-remove-${i}`}
                            onClick={() => setSlices(slices.filter((_, j) => j !== i))}
                            style={{
                              background: 'none', border: '1px solid var(--border)',
                              borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
                              ...M, fontSize: 10, padding: '2px 8px',
                            }}
                          >×</button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {PAY_MODES.map(m => (
                          <button
                            key={m}
                            type="button"
                            data-testid={`slice-${i}-method-${m}`}
                            onClick={() => setSlices(slices.map((x, j) => j === i ? { ...x, method: m } : x))}
                            style={{
                              padding: '4px 8px', borderRadius: 5, cursor: 'pointer',
                              border: `1px solid ${s.method === m ? 'rgba(61,199,173,0.5)' : 'var(--border-subtle)'}`,
                              background: s.method === m ? 'rgba(61,199,173,0.1)' : 'transparent',
                              color: s.method === m ? 'var(--teal-300)' : 'var(--text-muted)',
                              ...M, fontSize: 9, letterSpacing: '0.04em',
                            }}
                          >
                            {m.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="₱ amount"
                          data-testid={`slice-${i}-amount`}
                          value={s.amountPhp}
                          onChange={e => setSlices(slices.map((x, j) => j === i ? { ...x, amountPhp: e.target.value } : x))}
                          style={{
                            flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '8px 10px', color: 'var(--text-strong)',
                            ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                        {s.method !== 'CASH' && s.method !== 'OTHER' && (
                          <input
                            type="text"
                            placeholder={refRequired ? 'Reference #' : 'Reference # (optional)'}
                            data-testid={`slice-${i}-ref`}
                            value={s.referenceNo}
                            onChange={e => setSlices(slices.map((x, j) => j === i ? { ...x, referenceNo: e.target.value } : x))}
                            style={{
                              flex: 1.2, background: 'var(--bg-card)', border: '1px solid var(--border)',
                              borderRadius: 6, padding: '8px 10px', color: 'var(--text-strong)',
                              ...M, fontSize: 12, outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    data-testid="slice-add"
                    onClick={() => setSlices([...slices, { method: 'CASH', amountPhp: '', referenceNo: '' }])}
                    style={{
                      padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                      border: '1px dashed var(--border-subtle)', background: 'transparent',
                      color: 'var(--text-muted)', ...M, fontSize: 10, letterSpacing: '0.05em',
                    }}
                  >+ ADD SLICE</button>
                  {phpTotal != null && (
                    <span data-testid="slice-delta" style={{
                      ...M, fontSize: 10,
                      color: Math.abs(sliceDelta) < 0.01
                        ? 'var(--teal-300)'
                        : (sliceDelta > 0 ? 'var(--accent-gold)' : 'var(--accent-coral)'),
                    }}>
                      {Math.abs(sliceDelta) < 0.01
                        ? '✓ matches php amt'
                        : sliceDelta > 0
                          ? `₱remaining: ${sliceDelta.toFixed(2)}`
                          : `₱over: ${Math.abs(sliceDelta).toFixed(2)}`}
                    </span>
                  )}
                </div>
                {splitNeedsBank && (
                  <div>
                    <label style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>
                      BANK (for cheque/transfer slices)
                    </label>
                    <select
                      value={bankId ?? ''}
                      onChange={e => setBankId(e.target.value ? +e.target.value : null)}
                      style={{
                        width: '100%', background: 'var(--bg-card)',
                        border: `1px solid ${bankId ? 'rgba(61,199,173,0.4)' : '#ff5c5c44'}`,
                        borderRadius: 8, padding: '10px 14px', boxSizing: 'border-box',
                        color: bankId ? 'var(--text-strong)' : 'var(--text-muted)',
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
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              ...M, fontSize: 11, color: 'var(--accent-coral)',
              background: 'rgba(238,108,90,0.08)', border: '1px solid rgba(238,108,90,0.2)',
              borderRadius: 8, padding: '10px 14px',
            }}>
              ✗ {error}
            </div>
          )}

          {/* Batch flash */}
          {batchFlash && batchFlash.length > 0 && (
            <div style={{
              background: 'rgba(61,199,173,0.07)', border: '1px solid rgba(61,199,173,0.3)',
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ ...Y, fontSize: 12, fontWeight: 700, color: 'var(--teal-300)' }}>
                  ✓ Batch saved — {batchFlash.length} items
                </div>
                <button
                  onClick={() => printBatchReceipt(batchFlash)}
                  style={{
                    padding: '5px 14px', borderRadius: 6,
                    border: '1px solid rgba(61,199,173,0.4)',
                    background: 'rgba(61,199,173,0.1)', color: 'var(--teal-300)',
                    ...M, fontSize: 11, cursor: 'pointer',
                  }}
                >
                  🖨 Print Receipt
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {batchFlash.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ ...M, fontSize: 11, color: 'var(--text-strong)' }}>
                      {t.currency} &nbsp;{fmtFx(t.foreignAmt, t.currency, currencies)} @ {t.rate}
                    </div>
                    <div style={{ ...M, fontSize: 11, color: 'var(--teal-300)', fontWeight: 700 }}>{php(t.phpAmt)}</div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid rgba(61,199,173,0.2)', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>TOTAL</span>
                  <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: 'var(--teal-300)' }}>
                    {php(batchFlash.reduce((s, t) => s + t.phpAmt, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Single success flash */}
          {flash && (
            <div style={{
              background: 'rgba(61,199,173,0.07)', border: '1px solid rgba(61,199,173,0.3)',
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ ...Y, fontSize: 12, fontWeight: 700, color: 'var(--teal-300)' }}>
                  ✓ Saved — {flash.id}
                </div>
                <button
                  onClick={() => printReceipt(flash)}
                  style={{
                    padding: '5px 14px', borderRadius: 6,
                    border: '1px solid rgba(61,199,173,0.4)',
                    background: 'rgba(61,199,173,0.1)', color: 'var(--teal-300)',
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
                    <div style={{ ...M, fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>{k}</div>
                    <div style={{ ...M, fontSize: 11, color: 'var(--text-strong)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cart */}
          {cart.length > 0 && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 10 }}>
                CART — {cart.length} ITEM{cart.length > 1 ? 'S' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cart.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, ...M, fontSize: 12, color: 'var(--text-strong)' }}>
                      {item.ccy.flag} {item.ccy.code} &nbsp;
                      {fmtFx(item.foreign_amt, item.ccy.code, currencies)} @ {item.rate}
                    </div>
                    <div style={{ ...M, fontSize: 12, color: 'var(--teal-300)', fontWeight: 700, minWidth: 90, textAlign: 'right' }}>
                      {php(item.foreign_amt * item.rate)}
                    </div>
                    <button
                      onClick={() => setCart(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SUBTOTAL</span>
                <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>
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
                    ? 'var(--border-subtle)'
                    : type === 'BUY'
                      ? 'linear-gradient(135deg,#5b8cff,#3a6fef)'
                      : 'linear-gradient(135deg,#f5a623,#e09000)',
                  color: !canSubmit ? 'var(--text-muted)' : '#000',
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
                  background: !canSubmit ? 'transparent' : 'var(--bg-card)',
                  color: !canSubmit ? 'var(--text-muted)' : 'var(--text-strong)',
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
                    ? 'var(--border-subtle)'
                    : type === 'BUY'
                      ? 'linear-gradient(135deg,#00d4aa,#009977)'
                      : 'linear-gradient(135deg,#b45cf5,#8a2be2)',
                  color: loading ? 'var(--text-muted)' : '#000',
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
              { label: 'TOTAL BOUGHT', value: php(totalBought), color: 'var(--accent-sky)' },
              { label: 'TOTAL SOLD',   value: php(totalSold),   color: 'var(--accent-gold)' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 20px',
              }}>
                <div style={{ ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 8 }}>
                  {s.label}
                </div>
                <div style={{ ...Y, fontSize: 20, fontWeight: 800, color: s.color }}>
                  {s.value}
                </div>
                {s.label === 'TOTAL BOUGHT' && totalCommission !== 0 && (
                  <>
                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>COMM</span>
                      <span style={{ ...M, fontSize: 11, fontWeight: 700, color: totalCommission > 0 ? 'var(--teal-300)' : 'var(--accent-coral)' }}>
                        {totalCommission > 0 ? '+' : ''}{php(totalCommission)}
                      </span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>TOTAL</span>
                      <span style={{ ...Y, fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>
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
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden', flex: 1,
          }}>
            {/* List header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ ...M, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.15em' }}>
                TODAY&apos;S TRANSACTIONS — {myTxns.length}
              </div>
              <button
                onClick={fetchTxns}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', ...M, fontSize: 11 }}
              >
                ↺ refresh
              </button>
            </div>

            {myTxns.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', ...M, fontSize: 11, color: 'var(--text-muted)' }}>
                No transactions yet today.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                {/* Column labels */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 44px 52px 56px 68px 90px 88px 106px 92px 44px',
                  padding: '8px 20px', borderBottom: '1px solid var(--border)',
                  ...M, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em',
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
                  {myTxns.map((t, i) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 44px 52px 56px 68px 90px 88px 106px 92px 44px',
                        padding: '10px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>{t.id}</span>
                      <span style={{ ...M, fontSize: 10, color: 'var(--text-muted)' }}>{t.time}</span>
                      <span style={{
                        ...M, fontSize: 11, fontWeight: 700,
                        color: t.type === 'BUY' ? 'var(--accent-sky)' : 'var(--accent-gold)',
                      }}>{t.type}</span>
                      <span
                        style={{ ...M, fontSize: 9, color: t.paymentStatus === 'PENDING' ? 'var(--accent-gold)' : 'var(--text-muted)' }}
                        title={(t.payments && t.payments.length > 1)
                          ? t.payments.map(p => `${p.method} ${php(p.amountPhp)}${p.status === 'PENDING' ? ' (pending)' : ''}`).join(' · ')
                          : undefined}
                      >
                        {(() => {
                          const m = (t.paymentMode ?? 'CASH');
                          const label = m === 'BANK_TRANSFER' ? 'BANK' : m === 'SHOPEEPAY' ? 'SHPAY' : m;
                          return label;
                        })()}
                        {t.payments && t.payments.length > 1 && (
                          <span data-testid="split-chip" style={{ marginLeft: 3, color: 'var(--teal-300)' }}>
                            +{t.payments.length - 1}
                          </span>
                        )}
                        {t.paymentStatus === 'PENDING' && <span title="Payment pending — not yet received" style={{ marginLeft: 3 }}>⏳</span>}
                      </span>
                      <span style={{ ...M, fontSize: 13, color: 'var(--text-strong)' }}>{t.currency}</span>
                      <span style={{ ...M, fontSize: 12, color: 'var(--text-strong)' }}>
                        {fmtFx(t.foreignAmt, t.currency, currencies)}
                      </span>
                      <span style={{
                        ...M, fontSize: 11,
                        color: t.type === 'BUY' ? 'var(--accent-sky)' : 'var(--accent-gold)',
                      }}>{t.rate}</span>
                      <span style={{ ...M, fontSize: 11, color: 'var(--text-strong)' }}>{php(t.phpAmt)}</span>
                      {role === 'supervisor' ? (
                        t.paymentTag ? (
                          <span style={{
                            ...M, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                            padding: '2px 5px', borderRadius: 4,
                            color: t.paymentTag === 'ADVANCE' ? 'var(--teal-300)' : 'var(--accent-gold)',
                            background: t.paymentTag === 'ADVANCE' ? 'rgba(61,199,173,0.12)' : 'rgba(212,166,74,0.12)',
                            border: `1px solid ${t.paymentTag === 'ADVANCE' ? 'rgba(61,199,173,0.3)' : 'rgba(212,166,74,0.3)'}`,
                          }}>{t.paymentTag}</span>
                        ) : <span />
                      ) : (() => {
                        if (!t.officialRate) return <span />;
                        const comm = t.type === 'SELL'
                          ? (t.rate - t.officialRate) * t.foreignAmt
                          : (t.officialRate - t.rate) * t.foreignAmt;
                        if (comm === 0) return <span />;
                        return (
                          <span style={{ ...M, fontSize: 10, color: comm > 0 ? 'var(--teal-300)' : 'var(--accent-coral)' }}>
                            {comm > 0 ? '+' : '-'}{php(Math.abs(comm))}
                          </span>
                        );
                      })()}
                      {pendingEdits.has(t.id) ? (
                        <span title="Edit request pending admin approval" style={{
                          ...M, fontSize: 9, color: 'var(--accent-gold)',
                          background: 'rgba(212,166,74,0.12)',
                          border: '1px solid rgba(212,166,74,0.3)',
                          borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap',
                        }}>⏳</span>
                      ) : (
                        <button
                          onClick={() => openEdit(t)}
                          title={role === 'admin' ? 'Edit transaction' : 'Request edit'}
                          data-testid={`edit-btn-${t.id}`}
                          style={{
                            background: 'none', border: '1px solid var(--border)',
                            borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer',
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
