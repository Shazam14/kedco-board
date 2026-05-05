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

export default function InvestorShareShell() {
  const [periodLabel, setPeriodLabel] = useState('');
  const [grossStr,    setGrossStr]    = useState('');
  const [expensesStr, setExpensesStr] = useState('');
  const [lowStr,      setLowStr]      = useState('30');
  const [midStr,      setMidStr]      = useState('40');
  const [highStr,     setHighStr]     = useState('50');

  const gross    = parseNum(grossStr);
  const expenses = parseNum(expensesStr);
  const net      = gross - expenses;

  const pcts = {
    low:  parseNum(lowStr),
    mid:  parseNum(midStr),
    high: parseNum(highStr),
  };

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

      <div style={{ padding: '28px 32px', maxWidth: 980 }}>
        <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 4 }}>ADMIN · INVESTOR SHARE</div>
        <div style={{ ...Y, fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Investor Share Estimator</div>
        <div style={{ ...M, fontSize: 11, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
          Two views side-by-side: share off PHP gross profit, and share off net (after salaries and expenses).
          Tweak the bands to suit the month — generous when expenses are light, conservative when they bite.
        </div>

        {/* Inputs */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 14 }}>PERIOD TOTALS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>PERIOD (OPTIONAL)</div>
              <input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder="e.g. April 2026"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>PHP GROSS PROFIT (₱)</div>
              <input value={grossStr} onChange={e => setGrossStr(e.target.value)} placeholder="e.g. 1,200,000" inputMode="decimal"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>TOTAL EXPENSES (₱)</div>
              <input value={expensesStr} onChange={e => setExpensesStr(e.target.value)} placeholder="salaries + petty + ..." inputMode="decimal"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ ...M, fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginTop: 18, marginBottom: 10 }}>SHARE BANDS (%)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ ...M, fontSize: 9, color: '#5b8cff', marginBottom: 4 }}>CONSERVATIVE</div>
              <input value={lowStr} onChange={e => setLowStr(e.target.value)} inputMode="decimal"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: '#00d4aa', marginBottom: 4 }}>BALANCED</div>
              <input value={midStr} onChange={e => setMidStr(e.target.value)} inputMode="decimal"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ ...M, fontSize: 9, color: '#f5a623', marginBottom: 4 }}>GENEROUS</div>
              <input value={highStr} onChange={e => setHighStr(e.target.value)} inputMode="decimal"
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: '#e2e6f0', ...M, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
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
          Estimator only — nothing is saved. Use the band that fits the month: when expenses are light, lean toward GENEROUS; when payroll and operations bite, CONSERVATIVE keeps Ken whole.
        </div>
      </div>
    </div>
  );
}
