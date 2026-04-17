'use client';
import { useState } from 'react';
import { useNumberInput } from '@/hooks/useNumberInput';
import { fmtDate, fmtDateTime, todayPHT } from '@/lib/pht';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: '#e2e6f0',
  fontFamily: "'DM Mono',monospace", fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const label: React.CSSProperties = { fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--muted)', marginBottom: 4, display: 'block', letterSpacing: '0.08em' };

interface Installment { id: string; installment_no: number; due_date: string; amount: number; paid_at: string | null; received_by: string | null; }
interface Draw        { id: string; amount: number; notes: string | null; created_by: string; created_at: string; }
interface Credit      { id: string; customer_name: string; currency_code: string; principal: number; interest: number; credit_type: string; status: string; disbursed_date: string; notes: string | null; created_by: string; installments: Installment[]; draws: Draw[]; }
interface DrawRules   { interval_minutes: number; max_per_day: number; max_amount: number; }

const php = (n: number, currency = 'PHP') =>
  currency === 'PHP'
    ? '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;

const STATUS_COLOR: Record<string, string> = { ACTIVE: '#f5a623', COMPLETED: '#00d4aa', CANCELLED: '#ff5c5c' };


export default function CreditShell({ credits: initial }: { credits: Credit[] }) {
  const [credits, setCredits]         = useState<Credit[]>(initial);
  const [filter, setFilter]           = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ACTIVE');
  const [showForm, setShowForm]       = useState(false);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [busy, setBusy]               = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  // Draw state
  const [drawCreditId, setDrawCreditId] = useState<string | null>(null);
  const drawAmtInput                    = useNumberInput('', 2);
  const [drawNote, setDrawNote]         = useState('');
  const [drawSaving, setDrawSaving]     = useState(false);
  const [drawError, setDrawError]       = useState<string | null>(null);

  // Settings
  const [showSettings, setShowSettings]     = useState(false);
  const [rules, setRules]                   = useState<DrawRules | null>(null);
  const [ruleInterval, setRuleInterval]     = useState('');
  const [ruleMaxDay, setRuleMaxDay]         = useState('');
  const [ruleMaxAmt, setRuleMaxAmt]         = useState('');
  const [rulesSaving, setRulesSaving]       = useState(false);

  // ── New credit form state ─────────────────────────────────────────────────
  const [fName, setFName]             = useState('');
  const [fCurrency, setFCurrency]     = useState('PHP');
  const fPrincipalInput               = useNumberInput('', 2);
  const fInterestRateInput            = useNumberInput('', 4);
  const [fType, setFType]             = useState<'UPFRONT' | 'INSTALLMENT'>('UPFRONT');
  const [fDate, setFDate]             = useState('');
  const [fNotes, setFNotes]           = useState('');
  const [fCount, setFCount]           = useState('2');    // number of installments
  const [fDates, setFDates]           = useState<string[]>(['', '']); // due dates
  const [saving, setSaving]           = useState(false);

  function resetForm() {
    setFName(''); setFCurrency('PHP'); fPrincipalInput.setValue(''); fInterestRateInput.setValue('');
    setFType('UPFRONT'); setFDate(''); setFNotes(''); setFCount('2'); setFDates(['', '']);
  }

  function handleCountChange(val: string) {
    const n = Math.max(1, Math.min(12, parseInt(val) || 1));
    setFCount(String(n));
    setFDates(prev => {
      const next = Array(n).fill('');
      for (let i = 0; i < Math.min(prev.length, n); i++) next[i] = prev[i];
      return next;
    });
  }

  const principal    = parseFloat(fPrincipalInput.raw) || 0;
  const interestRate = parseFloat(fInterestRateInput.raw) || 0;
  const interest     = Math.round(principal * interestRate / 100 * 100) / 100;
  const count        = parseInt(fCount) || 1;
  const amountPerInstallment = fType === 'UPFRONT' ? principal : Math.round(((principal + interest) / count) * 100) / 100;

  async function submitCredit() {
    if (!fName.trim() || !fPrincipalInput.raw || !fInterestRateInput.raw || !fDate) { setError('Fill in all required fields.'); return; }
    if (fDates.some(d => !d)) { setError('Set all due dates.'); return; }

    setSaving(true); setError(null);
    const installments = fDates.map((due_date) => ({ due_date, amount: amountPerInstallment }));
    const res = await fetch('/api/admin/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:  fName.trim(),
        currency_code:  fCurrency.toUpperCase(),
        principal, interest,
        credit_type:    fType,
        disbursed_date: fDate,
        notes:          fNotes.trim() || null,
        installments,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setCredits(prev => [data, ...prev]);
      resetForm(); setShowForm(false);
    } else {
      setError(data.detail ?? data.error ?? 'Failed to save.');
    }
    setSaving(false);
  }

  async function markPaid(credit: Credit, inst: Installment) {
    setBusy(inst.id); setError(null);
    const res = await fetch(`/api/admin/credits/${credit.id}/installments/${inst.id}/pay`, { method: 'PATCH' });
    const data = await res.json();
    if (res.ok) {
      setCredits(prev => prev.map(c => c.id === credit.id ? data : c));
    } else {
      setError(data.detail ?? 'Failed to mark paid.');
    }
    setBusy(null);
  }

  async function cancelCredit(credit: Credit) {
    if (!confirm(`Cancel credit for ${credit.customer_name}? This cannot be undone.`)) return;
    setBusy(credit.id); setError(null);
    const res = await fetch(`/api/admin/credits/${credit.id}/cancel`, { method: 'PATCH' });
    const data = await res.json();
    if (res.ok) {
      setCredits(prev => prev.map(c => c.id === credit.id ? data : c));
    } else {
      setError(data.detail ?? 'Failed to cancel.');
    }
    setBusy(null);
  }

  async function handleDraw() {
    if (!drawCreditId || !drawAmtInput.raw) return;
    setDrawSaving(true); setDrawError(null);
    const res = await fetch(`/api/admin/credits/${drawCreditId}/draws`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: +drawAmtInput.raw, notes: drawNote.trim() || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setCredits(prev => prev.map(c => c.id === drawCreditId ? data : c));
      setDrawCreditId(null); drawAmtInput.setValue(''); setDrawNote('');
    } else {
      setDrawError(data.detail ?? 'Failed to record draw.');
    }
    setDrawSaving(false);
  }

  async function loadRules() {
    const res = await fetch('/api/admin/credits/settings/draw-rules');
    if (res.ok) {
      const r: DrawRules = await res.json();
      setRules(r);
      setRuleInterval(String(r.interval_minutes));
      setRuleMaxDay(String(r.max_per_day));
      setRuleMaxAmt(String(r.max_amount));
    }
  }

  async function saveRules() {
    setRulesSaving(true);
    const res = await fetch('/api/admin/credits/settings/draw-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interval_minutes: parseInt(ruleInterval) || 60,
        max_per_day:      parseInt(ruleMaxDay)   || 24,
        max_amount:       parseFloat(ruleMaxAmt) || 0,
      }),
    });
    if (res.ok) setRules(await res.json());
    setRulesSaving(false);
  }

  const filtered = credits.filter(c => filter === 'ALL' || c.status === filter);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>Special Credits</div>
          </div>
        </div>
        <a href="/admin" style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}>← Admin</a>
      </nav>

      <div style={{ padding: '28px 32px', maxWidth: 860 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>ADMIN · SPECIAL CREDITS</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ ...Y, fontSize: 24, fontWeight: 800 }}>Special Customer Credits</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowSettings(v => !v); if (!rules) loadRules(); }}
              style={{ ...M, fontSize: 11, padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: showSettings ? 'var(--surface2)' : 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
              ⚙ Rules
            </button>
            <button onClick={() => { setShowForm(v => !v); setError(null); }}
              style={{ ...Y, fontSize: 12, fontWeight: 800, padding: '8px 20px', borderRadius: 8, border: 'none', background: showForm ? 'var(--surface2)' : 'linear-gradient(135deg,#00d4aa,#00a884)', color: showForm ? 'var(--muted)' : '#000', cursor: 'pointer' }}>
              {showForm ? 'Cancel' : '+ New Credit'}
            </button>
          </div>
        </div>

        {/* ── Draw rules settings ─────────────────────────────────────── */}
        {showSettings && (
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 14, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ ...M, fontSize: 10, color: '#a78bfa', letterSpacing: '0.12em', marginBottom: 16 }}>DRAW RULES (ADMIN)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <span style={label}>MIN. INTERVAL (minutes)</span>
                <input type="number" min={0} value={ruleInterval} onChange={e => setRuleInterval(e.target.value)} style={inp} />
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>0 = no cooldown</div>
              </div>
              <div>
                <span style={label}>MAX DRAWS PER DAY</span>
                <input type="number" min={0} value={ruleMaxDay} onChange={e => setRuleMaxDay(e.target.value)} style={inp} />
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>0 = unlimited</div>
              </div>
              <div>
                <span style={label}>MAX AMOUNT PER DRAW</span>
                <input type="number" min={0} value={ruleMaxAmt} onChange={e => setRuleMaxAmt(e.target.value)} style={inp} />
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>0 = unlimited</div>
              </div>
            </div>
            <button onClick={saveRules} disabled={rulesSaving}
              style={{ ...M, fontSize: 11, padding: '8px 20px', borderRadius: 8, border: 'none', background: rulesSaving ? 'var(--surface2)' : '#a78bfa', color: rulesSaving ? 'var(--muted)' : '#000', cursor: rulesSaving ? 'default' : 'pointer' }}>
              {rulesSaving ? 'Saving…' : 'Save Rules'}
            </button>
          </div>
        )}

        {/* ── Create form ─────────────────────────────────────────────── */}
        {showForm && (
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 14, padding: '24px', marginBottom: 28 }}>
            <div style={{ ...M, fontSize: 10, color: '#00d4aa', letterSpacing: '0.12em', marginBottom: 20 }}>NEW CREDIT</div>

            {/* Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
              <div><span style={label}>CUSTOMER NAME *</span>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Juan Dela Cruz" style={inp} />
              </div>
              <div><span style={label}>CURRENCY *</span>
                <input value={fCurrency} onChange={e => setFCurrency(e.target.value.toUpperCase())} placeholder="PHP" maxLength={10} style={inp} />
              </div>
            </div>

            {/* Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <span style={label}>PRINCIPAL *</span>
                <input
                  type="text" inputMode="decimal"
                  ref={fPrincipalInput.ref}
                  value={fPrincipalInput.value}
                  onChange={fPrincipalInput.onChange}
                  onFocus={fPrincipalInput.onFocus}
                  placeholder="100,000"
                  style={inp}
                />
              </div>
              <div>
                <span style={label}>INTEREST RATE % *</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text" inputMode="decimal"
                    ref={fInterestRateInput.ref}
                    value={fInterestRateInput.value}
                    onChange={fInterestRateInput.onChange}
                    onFocus={fInterestRateInput.onFocus}
                    placeholder="5"
                    style={{ ...inp, paddingRight: 28 }}
                  />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', ...M, fontSize: 13, color: 'var(--muted)', pointerEvents: 'none' }}>%</span>
                </div>
                {principal > 0 && interestRate > 0 && (
                  <div style={{ ...M, fontSize: 10, color: '#00d4aa', marginTop: 4 }}>
                    = {php(interest, fCurrency)} interest
                  </div>
                )}
              </div>
              <div><span style={label}>DISBURSED DATE *</span>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={inp} />
              </div>
            </div>

            {/* Payment type */}
            <div style={{ marginBottom: 14 }}>
              <span style={label}>PAYMENT TYPE *</span>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['UPFRONT', 'INSTALLMENT'] as const).map(t => (
                  <button key={t} onClick={() => setFType(t)}
                    style={{ ...M, fontSize: 11, padding: '8px 20px', borderRadius: 8, border: `1px solid ${fType === t ? '#00d4aa' : 'var(--border)'}`, background: fType === t ? 'rgba(0,212,170,0.1)' : 'transparent', color: fType === t ? '#00d4aa' : 'var(--muted)', cursor: 'pointer' }}>
                    {t === 'UPFRONT' ? 'Upfront (Option A)' : 'Installment (Option B)'}
                  </button>
                ))}
              </div>
              {fType === 'UPFRONT' && principal > 0 && interest > 0 && (
                <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                  Ken gives: <span style={{ color: '#f5a623' }}>{php(principal - interest, fCurrency)}</span> — interest of <span style={{ color: '#00d4aa' }}>{php(interest, fCurrency)}</span> collected upfront. Customer pays back <span style={{ color: '#e2e6f0' }}>{php(principal, fCurrency)}</span>.
                </div>
              )}
              {fType === 'INSTALLMENT' && principal > 0 && interest > 0 && (
                <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                  Total due: <span style={{ color: '#e2e6f0' }}>{php(principal + interest, fCurrency)}</span> ÷ {count} payments = <span style={{ color: '#00d4aa' }}>{php(amountPerInstallment, fCurrency)}</span> each.
                </div>
              )}
            </div>

            {/* Installment count + dates */}
            {fType === 'INSTALLMENT' && (
              <div style={{ marginBottom: 14 }}>
                <span style={label}>NUMBER OF PAYMENTS *</span>
                <input type="number" min={1} max={12} value={fCount} onChange={e => handleCountChange(e.target.value)} style={{ ...inp, width: 100 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                  {fDates.map((d, i) => (
                    <div key={i}>
                      <span style={label}>PAYMENT {i + 1} DATE *</span>
                      <input type="date" value={d} onChange={e => setFDates(prev => { const n = [...prev]; n[i] = e.target.value; return n; })} style={{ ...inp, width: 160 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UPFRONT: single due date */}
            {fType === 'UPFRONT' && (
              <div style={{ marginBottom: 14 }}>
                <span style={label}>PAYBACK DUE DATE *</span>
                <input type="date" value={fDates[0] ?? ''} onChange={e => setFDates([e.target.value])} style={{ ...inp, width: 200 }} />
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: 20 }}>
              <span style={label}>NOTES (optional)</span>
              <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Anything worth noting about this customer" style={inp} />
            </div>

            {error && <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginBottom: 12 }}>{error}</div>}

            <button onClick={submitCredit} disabled={saving}
              style={{ ...Y, fontSize: 13, fontWeight: 800, padding: '10px 28px', borderRadius: 8, border: 'none', background: saving ? 'var(--surface2)' : 'linear-gradient(135deg,#00d4aa,#00a884)', color: saving ? 'var(--muted)' : '#000', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save Credit'}
            </button>
          </div>
        )}

        {/* ── Filter tabs ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ALL'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ ...M, fontSize: 10, padding: '5px 14px', borderRadius: 6, border: `1px solid ${filter === s ? STATUS_COLOR[s] ?? '#00d4aa' : 'var(--border)'}`, background: filter === s ? `${STATUS_COLOR[s] ?? '#00d4aa'}18` : 'transparent', color: filter === s ? STATUS_COLOR[s] ?? '#00d4aa' : 'var(--muted)', cursor: 'pointer', letterSpacing: '0.08em' }}>
              {s}
            </button>
          ))}
        </div>

        {/* ── Credit list ──────────────────────────────────────────────── */}
        {filtered.length === 0 && (
          <div style={{ ...M, fontSize: 12, color: 'var(--muted)', padding: '32px 0', textAlign: 'center' }}>
            No {filter.toLowerCase()} credits.
          </div>
        )}

        {filtered.map(credit => {
          const isOpen   = expanded === credit.id;
          const paid     = credit.installments.filter(i => i.paid_at).length;
          const total    = credit.installments.length;
          const overdue  = credit.installments.filter(i => !i.paid_at && i.due_date < todayPHT());

          return (
            <div key={credit.id} style={{ background: 'var(--surface)', border: `1px solid ${overdue.length && credit.status === 'ACTIVE' ? 'rgba(255,92,92,0.3)' : 'var(--border)'}`, borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
              {/* Header row */}
              <div
                onClick={() => setExpanded(isOpen ? null : credit.id)}
                style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ ...Y, fontSize: 15, fontWeight: 700 }}>{credit.customer_name}</span>
                    <span style={{ ...M, fontSize: 9, padding: '2px 8px', borderRadius: 4, background: `${STATUS_COLOR[credit.status]}22`, color: STATUS_COLOR[credit.status], letterSpacing: '0.1em' }}>{credit.status}</span>
                    <span style={{ ...M, fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', letterSpacing: '0.08em' }}>{credit.credit_type}</span>
                    {overdue.length > 0 && credit.status === 'ACTIVE' && (
                      <span style={{ ...M, fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,92,92,0.15)', color: '#ff5c5c', letterSpacing: '0.08em' }}>OVERDUE</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>Principal: <span style={{ color: '#e2e6f0' }}>{php(credit.principal, credit.currency_code)}</span></span>
                    <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>Interest: <span style={{ color: '#00d4aa' }}>{php(credit.interest, credit.currency_code)}</span></span>
                    <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>Disbursed: <span style={{ color: '#e2e6f0' }}>{fmtDate(credit.disbursed_date)}</span></span>
                    <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>Paid: <span style={{ color: paid === total ? '#00d4aa' : '#f5a623' }}>{paid}/{total}</span></span>
                  </div>
                </div>
                <span style={{ ...M, fontSize: 12, color: 'var(--muted)', userSelect: 'none' }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
                  {credit.notes && (
                    <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 16, fontStyle: 'italic' }}>{credit.notes}</div>
                  )}

                  <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 10 }}>PAYMENT SCHEDULE</div>
                  {credit.installments.map(inst => {
                    const isOverdue = !inst.paid_at && inst.due_date < todayPHT();
                    return (
                      <div key={inst.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span style={{ ...M, fontSize: 11, color: 'var(--muted)', minWidth: 60 }}>#{inst.installment_no}</span>
                          <span style={{ ...M, fontSize: 12, color: isOverdue ? '#ff5c5c' : inst.paid_at ? 'var(--muted)' : '#e2e6f0' }}>
                            Due {fmtDate(inst.due_date)}
                            {isOverdue && <span style={{ color: '#ff5c5c', marginLeft: 8 }}>OVERDUE</span>}
                          </span>
                          <span style={{ ...M, fontSize: 12, color: '#e2e6f0', fontWeight: 700 }}>{php(inst.amount, credit.currency_code)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {inst.paid_at ? (
                            <span style={{ ...M, fontSize: 10, color: '#00d4aa' }}>Paid {fmtDate(inst.paid_at)} by {inst.received_by}</span>
                          ) : credit.status === 'ACTIVE' ? (
                            <button
                              onClick={() => markPaid(credit, inst)}
                              disabled={busy === inst.id}
                              style={{ ...M, fontSize: 10, padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(0,212,170,0.4)', background: 'rgba(0,212,170,0.08)', color: '#00d4aa', cursor: 'pointer' }}>
                              {busy === inst.id ? '…' : 'Mark Paid'}
                            </button>
                          ) : (
                            <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Draw history */}
                  {credit.draws.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 8 }}>ADDITIONAL DRAWS</div>
                      {credit.draws.map((d, i) => (
                        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <span style={{ ...M, fontSize: 11, color: '#f5a623', fontWeight: 700 }}>{php(d.amount, credit.currency_code)}</span>
                            {d.notes && <span style={{ ...M, fontSize: 10, color: 'var(--muted)', marginLeft: 10 }}>{d.notes}</span>}
                          </div>
                          <span style={{ ...M, fontSize: 10, color: 'var(--muted)' }}>
                            #{i + 1} · {fmtDateTime(d.created_at)} · {d.created_by}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {credit.status === 'ACTIVE' && (
                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        onClick={() => { setDrawCreditId(credit.id); setDrawError(null); drawAmtInput.setValue(''); setDrawNote(''); }}
                        style={{ ...M, fontSize: 10, padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(245,166,35,0.35)', background: 'rgba(245,166,35,0.07)', color: '#f5a623', cursor: 'pointer' }}>
                        + Add Draw
                      </button>
                      <button
                        onClick={() => cancelCredit(credit)}
                        disabled={busy === credit.id}
                        style={{ ...M, fontSize: 10, padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(255,92,92,0.3)', background: 'transparent', color: '#ff5c5c', cursor: 'pointer' }}>
                        {busy === credit.id ? '…' : 'Cancel Credit'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add Draw Modal ── */}
      {drawCreditId && (() => {
        const credit = credits.find(c => c.id === drawCreditId);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 14, padding: '28px', width: '100%', maxWidth: 420 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ ...M, fontSize: 10, color: '#f5a623', letterSpacing: '0.2em', marginBottom: 4 }}>ADD DRAW</div>
                  <div style={{ ...Y, fontSize: 17, fontWeight: 800 }}>{credit?.customer_name}</div>
                </div>
                <button onClick={() => setDrawCreditId(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>

              <div style={{ marginBottom: 14 }}>
                <span style={label}>AMOUNT ({credit?.currency_code ?? 'PHP'}) *</span>
                <input
                  type="text" inputMode="decimal"
                  ref={drawAmtInput.ref}
                  value={drawAmtInput.value}
                  onChange={drawAmtInput.onChange}
                  onFocus={drawAmtInput.onFocus}
                  placeholder="0.00"
                  autoFocus
                  style={{ ...inp, fontSize: 18 }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={label}>NOTES (optional)</span>
                <input value={drawNote} onChange={e => setDrawNote(e.target.value)} placeholder="Reason for this draw" style={inp} />
              </div>

              {drawError && <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginBottom: 12 }}>{drawError}</div>}

              <button onClick={handleDraw} disabled={drawSaving || !drawAmtInput.raw}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: (!drawAmtInput.raw || drawSaving) ? 'var(--border)' : 'linear-gradient(135deg,#f5a623,#e09000)', color: (!drawAmtInput.raw || drawSaving) ? 'var(--muted)' : '#000', ...Y, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {drawSaving ? 'Recording…' : 'Record Draw'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
