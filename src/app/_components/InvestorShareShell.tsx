'use client';
import { useState } from 'react';

const M: React.CSSProperties = { fontFamily: "'DM Mono',monospace" };
const Y: React.CSSProperties = { fontFamily: "'Syne',sans-serif" };

const php = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseNum = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};

export interface Investor {
  id: string;
  name: string;
  capital_php: number;
  monthly_rate_pct: number;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface BandProps { label: string; pct: number; amount: number; tone: 'low' | 'mid' | 'high' }
function Band({ label, pct, amount, tone }: BandProps) {
  const color = tone === 'low' ? '#5b8cff' : tone === 'mid' ? '#00d4aa' : '#f5a623';
  return (
    <div style={{ borderTop: `1px solid ${color}22`, padding: '14px 18px', display: 'grid', gridTemplateColumns: '90px 60px 1fr', gap: 12, alignItems: 'center' }}>
      <span style={{ ...M, fontSize: 10, color, letterSpacing: '0.15em' }}>{label}</span>
      <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{pct}%</span>
      <span style={{ ...Y, fontSize: 16, fontWeight: 800, color, textAlign: 'right' }}>{php(amount)}</span>
    </div>
  );
}

interface CardProps { title: string; base: number; pcts: { low: number; mid: number; high: number }; subtitle: string }
function ShareCard({ title, base, pcts, subtitle }: CardProps) {
  const safeBase = Math.max(0, base);
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px' }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.18em', marginBottom: 6 }}>{title}</div>
        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{subtitle}</div>
        <div style={{ ...Y, fontSize: 22, fontWeight: 800, color: base < 0 ? '#ff5c5c' : '#e2e6f0' }}>{php(base)}</div>
      </div>
      <Band label="CONSERVATIVE" pct={pcts.low}  amount={safeBase * pcts.low  / 100} tone="low" />
      <Band label="BALANCED"     pct={pcts.mid}  amount={safeBase * pcts.mid  / 100} tone="mid" />
      <Band label="GENEROUS"     pct={pcts.high} amount={safeBase * pcts.high / 100} tone="high" />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

export default function InvestorShareShell({ initialInvestors }: { initialInvestors: Investor[] }) {
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors);

  // New-investor form
  const [newName,    setNewName]    = useState('');
  const [newCapStr,  setNewCapStr]  = useState('');
  const [newRateStr, setNewRateStr] = useState('2');
  const [newNote,    setNewNote]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Bands + period for the off-gross / off-net cards
  const [periodLabel, setPeriodLabel] = useState('');
  const [grossStr,    setGrossStr]    = useState('');
  const [expensesStr, setExpensesStr] = useState('');
  const [lowStr,      setLowStr]      = useState('30');
  const [midStr,      setMidStr]      = useState('40');
  const [highStr,     setHighStr]     = useState('50');

  async function refresh() {
    const res = await fetch('/api/admin/investors', { cache: 'no-store' });
    if (res.ok) setInvestors(await res.json());
  }

  async function addInvestor() {
    const cap = parseNum(newCapStr);
    const rate = parseNum(newRateStr);
    if (!newName.trim()) { setError('Name required.'); return; }
    if (cap <= 0)        { setError('Capital must be positive.'); return; }
    if (rate < 0)        { setError('Rate cannot be negative.'); return; }

    setSaving(true); setError(null);
    const res = await fetch('/api/admin/investors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        capital_php: cap,
        monthly_rate_pct: rate,
        note: newNote.trim() || null,
      }),
    });
    if (res.ok) {
      setNewName(''); setNewCapStr(''); setNewRateStr('2'); setNewNote('');
      await refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.detail ?? 'Failed to add investor.');
    }
    setSaving(false);
  }

  async function deleteInvestor(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the investor list?`)) return;
    const res = await fetch(`/api/admin/investors/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) await refresh();
  }

  async function patchInvestor(id: string, patch: Partial<Pick<Investor, 'capital_php' | 'monthly_rate_pct' | 'name' | 'note'>>) {
    const res = await fetch(`/api/admin/investors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) await refresh();
  }

  const totalCapital = investors.reduce((s, i) => s + i.capital_php, 0);
  const totalPayout  = investors.reduce((s, i) => s + i.capital_php * i.monthly_rate_pct / 100, 0);

  const gross    = parseNum(grossStr);
  const expenses = parseNum(expensesStr);
  const net      = gross - expenses;
  const pcts = { low: parseNum(lowStr), mid: parseNum(midStr), high: parseNum(highStr) };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ ...Y, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...M, fontSize: 9, color: 'var(--muted)' }}>Investor Share</div>
          </div>
        </div>
        <a href="/admin" style={{ ...M, fontSize: 11, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}>← Admin</a>
      </nav>

      <div style={{ padding: '28px 32px', maxWidth: 1080 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>ADMIN · INVESTOR SHARE</div>
        <div style={{ ...Y, fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Investor Share Estimator</div>
        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
          Per-investor monthly payout (capital × rate). The off-gross / off-net cards below
          act as a sanity check — does this month&apos;s profit cover the total payout?
        </div>

        {/* ── INVESTORS ────────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 14 }}>ADD INVESTOR</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 90px 1.4fr auto', gap: 10, alignItems: 'flex-start' }}>
              <div>
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>NAME</div>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Investor A" style={inputStyle} />
              </div>
              <div>
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>CAPITAL (₱)</div>
                <input value={newCapStr} onChange={e => setNewCapStr(e.target.value)} placeholder="6,000,000" inputMode="decimal" style={inputStyle} />
              </div>
              <div>
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>RATE %/MO</div>
                <input value={newRateStr} onChange={e => setNewRateStr(e.target.value)} inputMode="decimal" style={inputStyle} />
              </div>
              <div>
                <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>NOTE (OPTIONAL)</div>
                <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="e.g. paid monthly" style={inputStyle} />
              </div>
              <div style={{ paddingTop: 17 }}>
                <button onClick={addInvestor} disabled={saving || !newName || !newCapStr}
                  style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: (!newName || !newCapStr) ? 'var(--border)' : 'linear-gradient(135deg,#00d4aa,#00a884)', color: (!newName || !newCapStr) ? 'var(--muted)' : '#000', ...Y, fontSize: 12, fontWeight: 800, cursor: (!newName || !newCapStr) ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                  {saving ? '…' : '+ ADD'}
                </button>
              </div>
            </div>
            {error && <div style={{ ...M, fontSize: 11, color: '#ff5c5c', marginTop: 10 }}>{error}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 90px 1.4fr 140px 60px', gap: 12, padding: '12px 20px', ...M, fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', borderBottom: '1px solid var(--border)' }}>
            <div>NAME</div>
            <div style={{ textAlign: 'right' }}>CAPITAL</div>
            <div style={{ textAlign: 'right' }}>RATE</div>
            <div>NOTE</div>
            <div style={{ textAlign: 'right' }}>PAYOUT / MO</div>
            <div></div>
          </div>

          {investors.length === 0 && (
            <div style={{ ...M, fontSize: 11, color: 'var(--muted)', padding: '16px 20px' }}>No investors yet.</div>
          )}
          {investors.map((inv, i) => {
            const payout = inv.capital_php * inv.monthly_rate_pct / 100;
            return (
              <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 90px 1.4fr 140px 60px', gap: 12, alignItems: 'center', padding: '12px 20px', borderBottom: i < investors.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                <span style={{ ...Y, fontSize: 14, fontWeight: 700, color: '#e2e6f0' }}>{inv.name}</span>
                <input
                  defaultValue={inv.capital_php}
                  inputMode="decimal"
                  onBlur={e => { const v = parseNum(e.target.value); if (v > 0 && v !== inv.capital_php) patchInvestor(inv.id, { capital_php: v }); }}
                  style={{ ...inputStyle, padding: '6px 10px', textAlign: 'right' }}
                />
                <input
                  defaultValue={inv.monthly_rate_pct}
                  inputMode="decimal"
                  onBlur={e => { const v = parseNum(e.target.value); if (v >= 0 && v !== inv.monthly_rate_pct) patchInvestor(inv.id, { monthly_rate_pct: v }); }}
                  style={{ ...inputStyle, padding: '6px 10px', textAlign: 'right' }}
                />
                <span style={{ ...M, fontSize: 11, color: 'var(--muted)' }}>{inv.note ?? '—'}</span>
                <span style={{ ...Y, fontSize: 14, fontWeight: 800, color: '#00d4aa', textAlign: 'right' }}>{php(payout)}</span>
                <button onClick={() => deleteInvestor(inv.id, inv.name)} title="Remove"
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: '#ff5c5c', ...M, fontSize: 11, cursor: 'pointer' }}>×</button>
              </div>
            );
          })}

          {investors.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 90px 1.4fr 140px 60px', gap: 12, padding: '14px 20px', borderTop: '2px solid var(--border)', background: 'rgba(0,212,170,0.06)' }}>
              <span style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em' }}>TOTAL ({investors.length})</span>
              <span style={{ ...M, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{php(totalCapital)}</span>
              <span></span>
              <span></span>
              <span style={{ ...Y, fontSize: 16, fontWeight: 800, color: '#00d4aa', textAlign: 'right' }}>{php(totalPayout)}</span>
              <span></span>
            </div>
          )}
        </div>

        {/* ── SANITY-CHECK BANDS ───────────────────────────────────────────── */}
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 8 }}>SANITY CHECK · OFF PROFIT</div>
        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Compare the investor payout total above against bands of this month&apos;s profit. If the GENEROUS band still leaves Ken whole, the rates are sustainable.
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>PERIOD (OPTIONAL)</div>
              <input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder="e.g. April 2026" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>PHP GROSS PROFIT (₱)</div>
              <input value={grossStr} onChange={e => setGrossStr(e.target.value)} placeholder="e.g. 1,200,000" inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>TOTAL EXPENSES (₱)</div>
              <input value={expensesStr} onChange={e => setExpensesStr(e.target.value)} placeholder="salaries + petty + ..." inputMode="decimal" style={inputStyle} />
            </div>
          </div>

          <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginTop: 18, marginBottom: 10 }}>SHARE BANDS (%)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ ...M, fontSize: 9, color: '#5b8cff', marginBottom: 4 }}>CONSERVATIVE</div>
              <input value={lowStr} onChange={e => setLowStr(e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: '#00d4aa', marginBottom: 4 }}>BALANCED</div>
              <input value={midStr} onChange={e => setMidStr(e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: '#f5a623', marginBottom: 4 }}>GENEROUS</div>
              <input value={highStr} onChange={e => setHighStr(e.target.value)} inputMode="decimal" style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <ShareCard
            title={`OFF GROSS${periodLabel ? ' · ' + periodLabel.toUpperCase() : ''}`}
            subtitle="Share applied to PHP gross profit (no expenses subtracted)."
            base={gross}
            pcts={pcts}
          />
          <ShareCard
            title={`OFF NET${periodLabel ? ' · ' + periodLabel.toUpperCase() : ''}`}
            subtitle={`Net = gross − expenses (${php(net)})`}
            base={net}
            pcts={pcts}
          />
        </div>

        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', lineHeight: 1.7, padding: '14px 18px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12 }}>
          Per-investor payouts are saved. Bands and period totals are estimator-only — nothing is persisted there.
        </div>
      </div>
    </div>
  );
}
