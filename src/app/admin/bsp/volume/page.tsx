export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTokenRole } from '@/lib/api';
import PrintButton from './PrintButton';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

type CcyRow    = { currency: string;  buy_count: number; buy_php: number; sell_count: number; sell_php: number; total_count: number; total_php: number; };
type BranchRow = { branch_id: string; buy_count: number; buy_php: number; sell_count: number; sell_php: number; total_count: number; total_php: number; };
type MonthRow  = { month: string;     buy_count: number; buy_php: number; sell_count: number; sell_php: number; total_count: number; total_php: number; };

type Report = {
  period:  { year: number; quarter: number; from: string; to: string; is_current: boolean; filing_deadline: string | null };
  totals:  { buy_count: number; buy_php: number; sell_count: number; sell_php: number; total_count: number; total_php: number };
  by_currency: CcyRow[];
  by_branch:   BranchRow[];
  by_month:    MonthRow[];
};

type MonthlySeries = {
  threshold_php:        number;
  months_above:         number;
  average_monthly_php:  number;
  currently_type_f:     boolean;
  series:               { month: string; total_php: number; above_type_f: boolean }[];
};

const peso = (n: number) =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

async function fetchApi<T>(path: string, token: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export default async function BspVolumePage(props: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin') redirect('/');

  const sp = await props.searchParams;
  const reqYear    = sp.year    ? parseInt(sp.year, 10)    : undefined;
  const reqQuarter = sp.quarter ? parseInt(sp.quarter, 10) : undefined;

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value ?? '';

  const qs = new URLSearchParams();
  if (reqYear)    qs.set('year',    String(reqYear));
  if (reqQuarter) qs.set('quarter', String(reqQuarter));

  const [report, monthly] = await Promise.all([
    fetchApi<Report>(`/api/v1/bsp/quarterly-volume${qs.toString() ? '?' + qs : ''}`, token),
    fetchApi<MonthlySeries>('/api/v1/bsp/monthly-volume?months=12', token),
  ]);

  if (!report) {
    return (
      <div style={{ padding: 32, color: '#ff6b6b' }}>
        Failed to load BSP volume report. Check API connectivity.
      </div>
    );
  }

  const { period, totals, by_currency, by_branch, by_month } = report;
  const now = new Date();
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'#e2e6f0' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: #fff !important; color: #000 !important; }
          .print-shell { background: #fff !important; color: #000 !important; padding: 0 !important; }
          .print-card  { background: #fff !important; border: 1px solid #999 !important; color: #000 !important; }
          .print-muted { color: #555 !important; }
          .print-strong { color: #000 !important; }
          table th, table td { color: #000 !important; border-color: #999 !important; }
        }
      `}</style>

      <nav className="no-print" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:56, borderBottom:'1px solid var(--border)', background:'var(--nav-bg)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, fontFamily:"'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'var(--muted)', marginTop:-2 }}>BSP Compliance</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/admin" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontFamily:"'DM Mono',monospace", fontSize:11, textDecoration:'none' }}>← Admin</a>
        </div>
      </nav>

      <div className="print-shell" style={{ padding:'28px 32px', display:'flex', flexDirection:'column', gap:24 }}>
        <div>
          <div className="print-muted" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--muted)', letterSpacing:'0.2em', marginBottom:6 }}>BSP CIRCULAR 1222 · QUARTERLY MC/FX VOLUME</div>
          <div className="print-strong" style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, letterSpacing:'-0.02em' }}>
            Q{period.quarter} {period.year} · {peso(totals.total_php)}
          </div>
          <div className="print-muted" style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'var(--muted)', marginTop:4 }}>
            {period.from} → {period.to}
            {period.is_current && ' · IN PROGRESS'}
            {!period.is_current && period.filing_deadline && ` · FILE BY ${period.filing_deadline}`}
          </div>
        </div>

        {/* Picker + actions */}
        <form className="no-print" method="get" style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--muted)', letterSpacing:'0.1em' }}>YEAR</span>
            <select name="year" defaultValue={period.year} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', color:'#e2e6f0', fontFamily:"'DM Mono',monospace", fontSize:12 }}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--muted)', letterSpacing:'0.1em' }}>QUARTER</span>
            <select name="quarter" defaultValue={period.quarter} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', color:'#e2e6f0', fontFamily:"'DM Mono',monospace", fontSize:12 }}>
              {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
            </select>
          </label>
          <button type="submit" style={{ padding:'8px 16px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', color:'#e2e6f0', fontFamily:"'DM Mono',monospace", fontSize:11, cursor:'pointer', letterSpacing:'0.05em' }}>
            VIEW
          </button>
          <PrintButton />
        </form>

        {/* Headline cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:16 }}>
          <Card label="TOTAL VOLUME"  primary={peso(totals.total_php)}  secondary={`${totals.total_count.toLocaleString()} txns`} />
          <Card label="BUY"           primary={peso(totals.buy_php)}    secondary={`${totals.buy_count.toLocaleString()} txns`} />
          <Card label="SELL"          primary={peso(totals.sell_php)}   secondary={`${totals.sell_count.toLocaleString()} txns`} />
          <Card label="MONTHLY AVG"   primary={peso((totals.total_php / 3))} secondary="quarter ÷ 3" />
        </div>

        {/* Type F threshold panel */}
        {monthly && (
          <div className="print-card" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:20 }}>
            <div className="print-muted" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--muted)', letterSpacing:'0.2em', marginBottom:8 }}>
              TYPE F THRESHOLD CHECK (₱50M / MONTH)
            </div>
            <div style={{ display:'flex', gap:24, alignItems:'baseline', marginBottom:14, flexWrap:'wrap' }}>
              <div>
                <div className="print-strong" style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color: monthly.currently_type_f ? '#00d4aa' : '#f5a623' }}>
                  {monthly.currently_type_f ? 'CURRENTLY TYPE F' : 'ABOVE TYPE F'}
                </div>
                <div className="print-muted" style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'var(--muted)', marginTop:4 }}>
                  {monthly.months_above} of {monthly.series.length} months above ₱50M · avg {peso(monthly.average_monthly_php)}
                </div>
              </div>
            </div>
            <MonthlyChart series={monthly.series} threshold={monthly.threshold_php} />
          </div>
        )}

        {/* Currency breakdown */}
        <Section title="BY CURRENCY">
          <Table
            head={['Currency', 'Buy ₱', 'Buy #', 'Sell ₱', 'Sell #', 'Total ₱', 'Total #']}
            rows={by_currency.map(r => [
              r.currency, peso(r.buy_php), String(r.buy_count),
              peso(r.sell_php), String(r.sell_count),
              peso(r.total_php), String(r.total_count),
            ])}
          />
        </Section>

        {/* Branch breakdown */}
        <Section title="BY BRANCH">
          <Table
            head={['Branch', 'Buy ₱', 'Buy #', 'Sell ₱', 'Sell #', 'Total ₱', 'Total #']}
            rows={by_branch.map(r => [
              r.branch_id, peso(r.buy_php), String(r.buy_count),
              peso(r.sell_php), String(r.sell_count),
              peso(r.total_php), String(r.total_count),
            ])}
          />
        </Section>

        {/* Month breakdown */}
        <Section title="BY MONTH (within quarter)">
          <Table
            head={['Month', 'Buy ₱', 'Buy #', 'Sell ₱', 'Sell #', 'Total ₱', 'Total #']}
            rows={by_month.map(r => [
              monthLabel(r.month), peso(r.buy_php), String(r.buy_count),
              peso(r.sell_php), String(r.sell_count),
              peso(r.total_php), String(r.total_count),
            ])}
          />
        </Section>

        <div className="print-muted" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--muted)', marginTop:8 }}>
          Source: transactions table · type IN (BUY, SELL) · all payment statuses · EXCESS excluded.
          {!period.is_current && period.filing_deadline && ` Filing deadline ${period.filing_deadline} (10 business days after quarter-end).`}
        </div>
      </div>
    </div>
  );
}

function Card({ label, primary, secondary }: { label: string; primary: string; secondary: string }) {
  return (
    <div className="print-card" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:20 }}>
      <div className="print-muted" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--muted)', letterSpacing:'0.2em', marginBottom:8 }}>{label}</div>
      <div className="print-strong" style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:'#e2e6f0' }}>{primary}</div>
      <div className="print-muted" style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'var(--muted)', marginTop:6 }}>{secondary}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="print-muted" style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--muted)', letterSpacing:'0.2em', marginBottom:8 }}>{title}</div>
      {children}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'var(--muted)', padding:'12px 0' }}>No data.</div>;
  }
  return (
    <div className="print-card" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:"'DM Mono',monospace", fontSize:11 }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--border)' }}>
            {head.map((h, i) => (
              <th key={i} style={{ padding:'10px 14px', textAlign: i === 0 ? 'left' : 'right', color:'var(--muted)', fontWeight:600, letterSpacing:'0.1em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: ri < rows.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding:'10px 14px', textAlign: ci === 0 ? 'left' : 'right', color:'#e2e6f0' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyChart({ series, threshold }: { series: { month: string; total_php: number; above_type_f: boolean }[]; threshold: number }) {
  const max = Math.max(threshold, ...series.map(s => s.total_php));
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120, paddingTop:8 }}>
      {series.map(s => {
        const h = max > 0 ? (s.total_php / max) * 100 : 0;
        const thresholdPct = max > 0 ? (threshold / max) * 100 : 0;
        return (
          <div key={s.month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, position:'relative', height:'100%' }}>
            <div style={{ position:'relative', flex:1, width:'100%', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
              <div style={{
                width:'70%', height:`${h}%`, minHeight:2,
                background: s.above_type_f ? '#f5a623' : '#00d4aa',
                borderRadius:'3px 3px 0 0',
              }} title={`${monthLabel(s.month)}: ${peso(s.total_php)}`} />
              <div style={{
                position:'absolute', left:0, right:0, bottom:`${thresholdPct}%`,
                height:1, background:'#ff6b6b', opacity:0.5,
              }} />
            </div>
            <div className="print-muted" style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'var(--muted)' }}>
              {s.month.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
