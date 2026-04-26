'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import type { DashboardSummary, CurrencyPosition, Transaction } from '@/lib/types';
import { todayLongPHT, nowTimePHT } from '@/lib/pht';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DashboardTourButton, DashboardTourAutoStart } from './DashboardTour';

const php = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');
const fmt = (rate: number, dp: number) => rate.toFixed(dp);

function useWindowWidth() {
  const [w, setW] = useState(1440);
  useEffect(() => {
    setW(window.innerWidth);
    const handler = () => setW(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return w;
}

function useCountUp(target: number, duration = 1300) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const step = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * ease));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return val;
}

// ── Tracker Types ─────────────────────────────────────
interface TrackerEntry {
  id: string; date: string; customer: string;
  currency: string; foreignAmt: number; rate: number;
  totalPhp: number; cashPaid: number; checkAmt: number;
  checkNo: string; bank: string;
  status: 'PENDING' | 'FULLY PAID';
  depositedDate?: string; branch: string;
}
interface PbEntry {
  id: string; bank_code: string; bank_name: string;
  amount: number; deposited_date: string; logged_by: string;
  notes: string | null; running_total: number;
}
interface PbBank {
  bank_id: number; bank_name: string; bank_code: string;
  total: number; entries: PbEntry[];
}

const S: Record<string, React.CSSProperties> = {
  nav:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', height:'60px', borderBottom:'1px solid var(--border-subtle)', background:'var(--nav-bg)', backdropFilter:'blur(16px)', position:'sticky', top:0, zIndex:100 },
  ticker: { overflow:'hidden', borderBottom:'1px solid var(--border-subtle)', background:'var(--bg-raised)', padding:'8px 0' },
  page:   { padding:'28px 32px', display:'flex', flexDirection:'column', gap:'22px', position:'relative', zIndex:1 },
  card:   { background:'var(--bg-card)', border:'1px solid var(--border-subtle)', borderRadius:'14px', overflow:'hidden', boxShadow:'var(--shadow-card)' },
  mono:   { fontFamily:'var(--font-mono)' },
  syne:   { fontFamily:'var(--font-sans)', fontWeight:600 },
};

function Ticker({ positions }: { positions: CurrencyPosition[] }) {
  const items = positions.slice(0, 9).flatMap(c => [
    `${c.flag} ${c.code}  B:${fmt(c.todayBuyRate, c.decimalPlaces)}  S:${fmt(c.todaySellRate, c.decimalPlaces)}`
  ]);
  return (
    <div data-tour="ticker" style={S.ticker}>
      <div style={{ display:'flex', gap:'48px', whiteSpace:'nowrap', animation:'ticker 30s linear infinite', fontFamily:'var(--font-mono)', fontSize:'11px', color:'var(--text-muted)' }}>
        {[...items,...items].map((it,i) => <span key={i} style={{ flexShrink:0 }}><span style={{ color:'var(--teal-300)', marginRight:6 }}>◆</span>{it}</span>)}
      </div>
    </div>
  );
}

function useLiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Nav({ active, set, role }: { active:string; set:(s:string)=>void; role:string }) {
  const router = useRouter();
  const now    = useLiveClock();
  const w      = useWindowWidth();
  const isMobile = w < 768;
  const dateStr = now ? now.toLocaleDateString('en-PH', { timeZone:'Asia/Manila', month:'short', day:'numeric', year:'numeric' }) : '';
  const timeStr = now ? now.toLocaleTimeString('en-PH', { timeZone:'Asia/Manila', hour:'2-digit', minute:'2-digit', hour12:true }) : '';
  const tabs = ['Dashboard','Positions','Transactions','Rider','Rate Board','Tracker'];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method:'POST' });
    router.push('/login');
  }

  return (
    <nav style={{ ...S.nav, flexWrap: isMobile ? 'wrap' : 'nowrap', height: isMobile ? 'auto' : '60px', padding: isMobile ? '10px 16px' : '0 28px', gap: isMobile ? 8 : 0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,var(--teal-300),var(--teal-600))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'var(--text-on-teal)', fontFamily:'var(--font-display)' }}>K</div>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text-strong)', letterSpacing:'0.02em' }}>Kedco<span style={{ color:'var(--teal-300)' }}>FX</span></div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-faint)', marginTop:-1 }}>Pusok · Lapu-Lapu City</div>
        </div>
      </div>
      {/* Tabs — horizontally scrollable on mobile */}
      <div data-tour="nav-tabs" style={{ display:'flex', gap:4, overflowX:'auto', flexShrink: isMobile ? 0 : 1, width: isMobile ? '100%' : 'auto', paddingBottom: isMobile ? 4 : 0, marginLeft: isMobile ? 0 : 8 }}>
        {tabs.map(t => (
          <button key={t} onClick={()=>set(t)} style={{ padding:'6px 12px', borderRadius:8, border: active===t ? '1px solid rgba(31,170,146,0.25)' : '1px solid transparent', cursor:'pointer', fontSize:12, fontWeight:500, background: active===t ? 'rgba(31,170,146,0.14)' : 'transparent', color: active===t ? 'var(--text-strong)' : 'var(--text-muted)', transition:'all 0.15s', whiteSpace:'nowrap', flexShrink:0 }}>{t}</button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, background:'rgba(61,199,173,0.1)', border:'1px solid rgba(61,199,173,0.25)' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--teal-300)', boxShadow:'0 0 6px var(--teal-300)' }} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--teal-300)', fontWeight:500 }}>LIVE</span>
          {!isMobile && now && <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-faint)' }}>· {timeStr}</span>}
        </div>
        <a href="/guide" style={{ padding:'5px 12px', borderRadius:6, border:'1px solid var(--border-subtle)', background:'transparent', color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:10, cursor:'pointer', letterSpacing:'0.05em', textDecoration:'none' }}>GUIDE</a>
        <DashboardTourButton />
        {['admin','supervisor'].includes(role) && <a data-tour="admin-btn" href="/admin" style={{ padding:'5px 12px', borderRadius:6, border:'1px solid rgba(61,199,173,0.25)', background:'rgba(61,199,173,0.06)', color:'var(--teal-300)', fontFamily:'var(--font-mono)', fontSize:10, cursor:'pointer', letterSpacing:'0.05em', textDecoration:'none' }}>ADMIN</a>}
        <button onClick={handleLogout} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid var(--border-subtle)', background:'transparent', color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:10, cursor:'pointer', letterSpacing:'0.05em' }}>LOGOUT</button>
      </div>
    </nav>
  );
}

function DashboardTab({ data, role }: { data: DashboardSummary; role: string }) {
  const isAdmin = role === 'admin';
  const w = useWindowWidth();
  const isMobile = w < 768;
  const capitalGain = data.totalCapital - data.openingCapital;
  const capital = useCountUp(data.totalCapital, 1400);
  const gain    = useCountUp(capitalGain, 1400);
  const than    = useCountUp(data.totalThanToday, 1000);

  const chartData = data.capitalTrend.length > 1
    ? data.capitalTrend.map(p => ({ t: p.date, cap: p.value }))
    : [{ t: 'Open', cap: data.openingCapital }, { t: 'Now', cap: data.totalCapital }];
  const pieData = [
    { name:'MAIN',     value: data.positions.filter(c=>c.category==='MAIN').reduce((s,c)=>s+c.stockValuePhp,0),   color:'var(--teal-300)' },
    { name:'2ND',      value: data.positions.filter(c=>c.category==='2ND').reduce((s,c)=>s+c.stockValuePhp,0),    color:'var(--accent-sky)' },
    { name:'OTHERS',   value: data.positions.filter(c=>c.category==='OTHERS').reduce((s,c)=>s+c.stockValuePhp,0), color:'var(--accent-gold)' },
    { name:'PHP Cash', value: data.phpCash, color:'var(--accent-sky)' },
  ];
  const buyCount  = data.recentTransactions.filter(t=>t.type==='BUY').length;
  const sellCount = data.recentTransactions.filter(t=>t.type==='SELL').length;

  return (
    <div style={{ ...S.page, padding: isMobile ? '16px' : '28px 32px' }}>
      {/* HERO */}
      <div data-tour="capital-hero" style={{
        background:'radial-gradient(120% 80% at 10% 0%, rgba(61,199,173,0.18), transparent 55%), radial-gradient(80% 60% at 100% 100%, rgba(13,138,120,0.25), transparent 60%), linear-gradient(180deg, #0b3036 0%, #06222a 100%)',
        border:'1px solid var(--border-soft)', borderRadius:'var(--r-xl)', padding: isMobile ? '20px 18px' : '30px 32px', position:'relative', overflow:'hidden', animation:'fadeUp 0.4s ease both', boxShadow:'var(--shadow-pop)'
      }}>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap:24, alignItems:'center' }}>
          <div>
            <div style={{ ...S.mono, fontSize:10, color:'var(--text-faint)', letterSpacing:'0.2em', marginBottom:10 }}>TOTAL CAPITAL POSITION — PHP EQUIVALENT</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(38px,5vw,58px)', fontWeight:500, color:'var(--text-strong)', lineHeight:1, letterSpacing:'-0.02em', marginBottom:12, fontVariantNumeric:'tabular-nums' }}>{php(capital)}</div>
            <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <span style={{ ...S.mono, fontSize:12, color:'var(--teal-300)', background:'rgba(61,199,173,0.1)', padding:'4px 12px', borderRadius:20, border:'1px solid rgba(61,199,173,0.25)' }}>+{php(gain)} vs opening {php(data.openingCapital)}</span>
              <span style={{ ...S.mono, fontSize:12, color:'var(--text-muted)' }}>+{((capitalGain/data.openingCapital)*100).toFixed(2)}% today</span>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:190 }}>
            {[
              { label:'PHP CASH',       val:data.phpCash,         color:'var(--accent-gold)' },
              { label:'FX STOCK VALUE', val:data.totalStockValue, color:'var(--teal-200)' },
              { label:'UNREALIZED GAIN',val:data.totalUnrealized, color:'var(--pos)', prefix:'+' },
            ].map(row => (
              <div key={row.label} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border-subtle)', borderRadius:10, padding:'12px 16px' }}>
                <div style={{ ...S.mono, fontSize:9, color:'var(--text-faint)', marginBottom:3, letterSpacing:'0.12em' }}>{row.label}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:row.color, fontVariantNumeric:'tabular-nums' }}>{row.prefix||''}{php(row.val)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div data-tour="than-card" style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${isAdmin ? 3 : 2},1fr)`, gap:14 }}>
        {[
          ...(isAdmin ? [{ label:'TODAY THAN (MARGIN)', val:php(than), sub:'Counter + rider combined', color:'var(--teal-300)', icon:'📈', d:100 }] : []),
          { label:'BOUGHT TODAY',        val:php(data.totalBoughtToday),sub:`${buyCount} transactions`,             color:'var(--accent-sky)', icon:'💱', d:150 },
          { label:'SOLD TODAY',          val:php(data.totalSoldToday),  sub:`${sellCount} transactions`,            color:'var(--accent-gold)', icon:'💸', d:200 },
        ].map(card => (
          <div key={card.label} style={{ ...S.card, padding:'20px 22px', position:'relative', overflow:'hidden', animation:`fadeUp 0.5s ease ${card.d}ms both` }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${card.color},transparent)` }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div style={{ ...S.mono, fontSize:9, color:'var(--text-muted)', letterSpacing:'0.15em' }}>{card.label}</div>
              <span style={{ fontSize:16 }}>{card.icon}</span>
            </div>
            <div style={{ ...S.syne, fontSize:24, fontWeight:800, color:card.color, lineHeight:1, marginBottom:5 }}>{card.val}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* CHART + PIE */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap:16 }}>
        <div style={{ ...S.card, padding:24, animation:'fadeUp 0.5s ease 0.3s both' }}>
          <div style={{ ...S.syne, fontSize:14, fontWeight:700, marginBottom:2 }}>Capital Movement Today</div>
          <div style={{ ...S.mono, fontSize:9, color:'var(--text-muted)', marginBottom:18, letterSpacing:'0.15em' }}>PHP EQUIVALENT · REAL-TIME</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top:4, right:4, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--teal-300)" stopOpacity={0.22}/>
                  <stop offset="95%" stopColor="var(--teal-300)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill:'var(--text-muted)', fontSize:10, fontFamily:'DM Mono' }} axisLine={false} tickLine={false}/>
              <YAxis domain={['auto','auto']} tick={{ fill:'var(--text-muted)', fontSize:10, fontFamily:'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v=>`₱${(v/1000).toFixed(0)}K`} width={54}/>
              <Tooltip contentStyle={{ background:'var(--bg-card-2)', border:'1px solid var(--border)', borderRadius:8, fontFamily:'DM Mono', fontSize:11 }} labelStyle={{ color:'var(--text-muted)' }} formatter={(v) => [php(Number(v ?? 0)), 'Capital']}/>
              <Area type="monotone" dataKey="cap" stroke="var(--teal-300)" strokeWidth={2} fill="url(#cg)" dot={false} activeDot={{ r:4, fill:'var(--teal-300)' }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...S.card, padding:24, animation:'fadeUp 0.5s ease 0.35s both' }}>
          <div style={{ ...S.syne, fontSize:14, fontWeight:700, marginBottom:2 }}>Capital Mix</div>
          <div style={{ ...S.mono, fontSize:9, color:'var(--text-muted)', marginBottom:14, letterSpacing:'0.15em' }}>BY CATEGORY</div>
          <div style={{ display:'flex', justifyContent:'center' }}>
            <PieChart width={150} height={150}>
              <Pie data={pieData} cx={71} cy={71} innerRadius={44} outerRadius={68} dataKey="value" strokeWidth={0}>
                {pieData.map((d,i) => <Cell key={i} fill={d.color}/>)}
              </Pie>
            </PieChart>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <div style={{ width:7, height:7, borderRadius:2, background:d.color }}/>
                  <span style={{ ...S.mono, fontSize:10, color:'var(--text-muted)' }}>{d.name}</span>
                </div>
                <span style={{ ...S.mono, fontSize:11 }}>{php(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECENT TXN */}
      <div data-tour="recent-txns" style={{ ...S.card, animation:'fadeUp 0.5s ease 0.4s both' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ ...S.syne, fontSize:14, fontWeight:700 }}>Recent Transactions</div>
            <div style={{ ...S.mono, fontSize:9, color:'var(--text-muted)', letterSpacing:'0.12em', marginTop:2 }}>COUNTER + RIDER · TODAY</div>
          </div>
          <span style={{ ...S.mono, fontSize:11, color:'var(--teal-300)' }}>{data.recentTransactions.length} today</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          {data.recentTransactions.slice(0,6).map((t,i) => (
            <div key={t.id} style={{ display:'grid', gridTemplateColumns:isAdmin ? '90px 58px 62px 70px 1fr 90px 80px' : '90px 58px 62px 70px 1fr 90px', padding:'11px 24px', borderBottom:i<5?'1px solid var(--border)':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:10, fontSize:12, minWidth:isAdmin ? 560 : 480 }}>
              <span style={{ ...S.mono, fontSize:10, color:'var(--text-muted)' }}>{t.time}</span>
              <span style={{ ...S.mono, fontSize:10, textAlign:'center', padding:'2px 0', borderRadius:4, color:t.type==='BUY'?'var(--accent-sky)':'var(--accent-gold)', background:t.type==='BUY'?'rgba(95,183,212,0.1)':'rgba(212,166,74,0.1)' }}>{t.type}</span>
              <span style={{ ...S.mono, fontSize:10, textAlign:'center', color:t.source==='RIDER'?'var(--accent-sky)':'var(--text-muted)' }}>{t.source==='RIDER'?'🏍️ RDR':'🖥️ CTR'}</span>
              <span style={{ ...S.mono, fontSize:12, color:'var(--accent-gold)', fontWeight:500 }}>{t.currency}</span>
              <span style={{ ...S.mono, fontSize:11, color:'var(--text-muted)' }}>{t.foreignAmt.toLocaleString()} @ {t.rate}</span>
              <span style={{ ...S.mono, fontSize:12, color:'var(--text-strong)', fontWeight:500, textAlign:'right' }}>{php(t.phpAmt)}</span>
              {isAdmin && <span style={{ ...S.mono, fontSize:11, color:'var(--teal-300)', textAlign:'right' }}>{t.type==='SELL'?'+'+php(t.than):'—'}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PositionsTab({ data }: { data: DashboardSummary }) {
  const w = useWindowWidth();
  const isMobile = w < 768;
  const { positions } = data;
  const [filter, setFilter] = useState<'ALL'|'MAIN'|'2ND'|'OTHERS'>('ALL');
  const filtered = filter==='ALL' ? positions : positions.filter(c=>c.category===filter);
  return (
    <div style={{ ...S.page, padding: isMobile ? '16px' : '28px 32px' }}>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap:14 }}>
        {(['MAIN','2ND','OTHERS'] as const).map(cat => {
          const items = positions.filter(c=>c.category===cat);
          return (
            <div key={cat} style={{ ...S.card, padding:'18px 20px' }}>
              <div style={{ ...S.mono, fontSize:9, color:'var(--text-muted)', marginBottom:6, letterSpacing:'0.15em' }}>{cat} · {items.length} currencies</div>
              <div style={{ ...S.syne, fontSize:20, fontWeight:800, marginBottom:4 }}>{php(items.reduce((s,c)=>s+c.stockValuePhp,0))}</div>
              <div style={{ ...S.mono, fontSize:11, color:'var(--teal-300)' }}>+{php(items.reduce((s,c)=>s+c.unrealizedPHP,0))} unrealized</div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {(['ALL','MAIN','2ND','OTHERS'] as const).map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.1em', border:`1px solid ${filter===f?'var(--teal-300)':'var(--border-subtle)'}`, background:filter===f?'rgba(61,199,173,0.1)':'transparent', color:filter===f?'var(--teal-300)':'var(--text-muted)' }}>{f}</button>
        ))}
      </div>
      <div style={S.card}>
        <div style={{ overflowX:'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'130px 110px 120px 100px 100px 110px 100px', padding:'10px 20px', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', letterSpacing:'0.1em', gap:8, minWidth:700 }}>
            <span>CURRENCY</span><span>STOCK QTY</span><span>AVG COST (PHP)</span><span>BUY RATE</span><span>SELL RATE</span><span>STOCK VALUE</span><span>UNREALIZED</span>
          </div>
          {filtered.map((c,i) => (
            <div key={c.code} style={{ display:'grid', gridTemplateColumns:'130px 110px 120px 100px 100px 110px 100px', padding:'13px 20px', borderBottom:i<filtered.length-1?'1px solid var(--border)':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:8, minWidth:700 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:15 }}>{c.flag}</span>
                <div>
                  <div style={{ ...S.mono, fontSize:12, color:'var(--accent-gold)', fontWeight:500 }}>{c.code}</div>
                  <div style={{ ...S.mono, fontSize:9, color:'var(--text-muted)' }}>{c.category}</div>
                </div>
              </div>
              <span style={{ ...S.mono, fontSize:11 }}>{c.totalQty.toLocaleString()}</span>
              <span style={{ ...S.mono, fontSize:11, color:'var(--text-muted)' }}>{fmt(c.dailyAvgCost, c.decimalPlaces)}</span>
              <span style={{ ...S.mono, fontSize:11 }}>{fmt(c.todayBuyRate, c.decimalPlaces)}</span>
              <span style={{ ...S.mono, fontSize:11, color:'var(--teal-300)' }}>{fmt(c.todaySellRate, c.decimalPlaces)}</span>
              <span style={{ ...S.mono, fontSize:12, fontWeight:500 }}>{php(c.stockValuePhp)}</span>
              <span style={{ ...S.mono, fontSize:11, color:'var(--teal-300)' }}>+{php(c.unrealizedPHP)}</span>
            </div>
          ))}
          <div style={{ display:'grid', gridTemplateColumns:'130px 110px 120px 100px 100px 110px 100px', padding:'12px 20px', borderTop:'1px solid var(--border)', background:'rgba(95,183,212,0.04)', gap:8, alignItems:'center', minWidth:700 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:15 }}>🇵🇭</span><div><div style={{ ...S.mono, fontSize:12, color:'var(--accent-sky)', fontWeight:500 }}>PHP</div><div style={{ ...S.mono, fontSize:9, color:'var(--text-muted)' }}>CASH</div></div></div>
            <span style={{ ...S.mono, fontSize:11, color:'var(--text-muted)', gridColumn:'span 4' }}>Cash on hand</span>
            <span style={{ ...S.mono, fontSize:12, color:'var(--accent-sky)', fontWeight:500 }}>{php(data.phpCash)}</span>
            <span style={{ ...S.mono, fontSize:11, color:'var(--text-muted)' }}>—</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'130px 110px 120px 100px 100px 110px 100px', padding:'14px 20px', borderTop:'2px solid rgba(61,199,173,0.35)', background:'rgba(61,199,173,0.06)', gap:8, alignItems:'center', minWidth:700 }}>
            <span style={{ ...S.syne, fontSize:13, fontWeight:800, color:'var(--teal-300)' }}>TOTAL</span>
            <span style={{ ...S.mono, fontSize:11, color:'var(--text-muted)', gridColumn:'span 4' }}>{positions.length} currencies + PHP cash</span>
            <span style={{ ...S.mono, fontSize:14, color:'var(--teal-300)', fontWeight:500 }}>{php(data.totalCapital)}</span>
            <span style={{ ...S.mono, fontSize:12, color:'var(--teal-300)' }}>+{php(data.totalUnrealized)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionsTab({ data, role }: { data: DashboardSummary; role: string }) {
  const isAdmin = role === 'admin';
  const { recentTransactions: txns } = data;
  const [tF, setTF] = useState<'ALL'|'BUY'|'SELL'>('ALL');
  const [sF, setSF] = useState<'ALL'|'COUNTER'|'RIDER'>('ALL');
  const filtered = txns.filter(t=>(tF==='ALL'||t.type===tF)&&(sF==='ALL'||t.source===sF));
  const w = useWindowWidth();
  const isMobile = w < 768;
  return (
    <div style={{ ...S.page, padding: isMobile ? '16px' : '28px 32px' }}>
      <div style={{ display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6 }}>
          {(['ALL','BUY','SELL'] as const).map(f => <button key={f} onClick={()=>setTF(f)} style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.1em', border:`1px solid ${tF===f?(f==='BUY'?'var(--accent-sky)':f==='SELL'?'var(--accent-gold)':'var(--teal-300)'):'var(--border-subtle)'}`, background:tF===f?(f==='BUY'?'rgba(95,183,212,0.1)':f==='SELL'?'rgba(212,166,74,0.1)':'rgba(61,199,173,0.1)'):'transparent', color:tF===f?(f==='BUY'?'var(--accent-sky)':f==='SELL'?'var(--accent-gold)':'var(--teal-300)'):'var(--text-muted)' }}>{f}</button>)}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {(['ALL','COUNTER','RIDER'] as const).map(f => <button key={f} onClick={()=>setSF(f)} style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.1em', border:`1px solid ${sF===f?'var(--accent-sky)':'var(--border-subtle)'}`, background:sF===f?'rgba(95,183,212,0.1)':'transparent', color:sF===f?'var(--accent-sky)':'var(--text-muted)' }}>{f==='COUNTER'?'🖥️ COUNTER':f==='RIDER'?'🏍️ RIDER':f}</button>)}
        </div>
        {isAdmin && <div style={{ marginLeft:'auto', ...S.mono, fontSize:11, color:'var(--teal-300)' }}>THAN from filtered: {php(filtered.filter(t=>t.type==='SELL').reduce((s,t)=>s+t.than,0))}</div>}
      </div>
      <div style={S.card}>
        <div style={{ overflowX:'auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:isAdmin ? '110px 70px 58px 80px 70px 1fr 90px 80px 130px' : '110px 70px 58px 80px 70px 1fr 90px 130px', padding:'10px 20px', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', letterSpacing:'0.1em', gap:10, minWidth:isAdmin ? 700 : 620 }}>
            <span>OR/REF</span><span>TIME</span><span>TYPE</span><span>SOURCE</span><span>CCY</span><span>AMT @ RATE</span><span>PHP TOTAL</span>{isAdmin && <span>THAN</span>}<span>CASHIER/CLIENT</span>
          </div>
          {filtered.map((t,i) => (
            <div key={t.id} style={{ display:'grid', gridTemplateColumns:isAdmin ? '110px 70px 58px 80px 70px 1fr 90px 80px 130px' : '110px 70px 58px 80px 70px 1fr 90px 130px', padding:'12px 20px', borderBottom:i<filtered.length-1?'1px solid var(--border)':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:10, minWidth:isAdmin ? 700 : 620 }}>
              <span style={{ ...S.mono, fontSize:9, color:'var(--text-muted)' }}>{t.id}</span>
              <span style={{ ...S.mono, fontSize:10, color:'var(--text-muted)' }}>{t.time}</span>
              <span style={{ ...S.mono, fontSize:10, textAlign:'center', padding:'2px 0', borderRadius:4, color:t.type==='BUY'?'var(--accent-sky)':'var(--accent-gold)', background:t.type==='BUY'?'rgba(95,183,212,0.1)':'rgba(212,166,74,0.1)' }}>{t.type}</span>
              <span style={{ ...S.mono, fontSize:10, color:t.source==='RIDER'?'var(--accent-sky)':'var(--text-muted)' }}>{t.source==='RIDER'?'🏍️ Rider':'🖥️ Ctr'}</span>
              <span style={{ ...S.mono, fontSize:13, color:'var(--accent-gold)', fontWeight:500 }}>{t.currency}</span>
              <span style={{ ...S.mono, fontSize:11, color:'var(--text-muted)' }}>{t.foreignAmt.toLocaleString()} @ {t.rate}</span>
              <span style={{ ...S.mono, fontSize:12, fontWeight:500 }}>{php(t.phpAmt)}</span>
              {isAdmin && <span style={{ ...S.mono, fontSize:11, color:t.type==='SELL'?'var(--teal-300)':'var(--text-muted)' }}>{t.type==='SELL'?'+'+php(t.than):'—'}</span>}
              <div style={{ ...S.mono, fontSize:10 }}><div>{t.cashier}</div>{t.customer&&<div style={{ color:'var(--text-muted)' }}>{t.customer}</div>}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding:'40px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>No transactions recorded yet today.</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Dispatch {
  id: string;
  rider_username: string;
  rider_name: string;
  status: string;
  dispatch_time: string | null;
  return_time: string | null;
  cash_php: number;
  notes: string | null;
  dispatched_by: string | null;
}
interface RiderUser { username: string; full_name: string; }

function RiderTab({ data, role }: { data: DashboardSummary; role: string }) {
  const isAdmin = role === 'admin';
  const w = useWindowWidth();
  const isMobile = w < 768;

  const [dispatches,  setDispatches]  = useState<Dispatch[]>([]);
  const [riders,      setRiders]      = useState<RiderUser[]>([]);
  const [selRider,    setSelRider]    = useState('');
  const [cashPhp,     setCashPhp]     = useState('');
  const [notes,       setNotes]       = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [returning,   setReturning]   = useState<string | null>(null);
  const [dispErr,     setDispErr]     = useState<string | null>(null);

  const fetchDispatches = useCallback(async () => {
    const res = await fetch('/api/admin/dispatches');
    if (res.ok) setDispatches(await res.json());
  }, []);

  useEffect(() => {
    fetchDispatches();
    fetch('/api/admin/riders').then(r => r.ok ? r.json() : []).then(setRiders);
  }, [fetchDispatches]);

  async function handleDispatch() {
    if (!selRider || !cashPhp || +cashPhp <= 0) return;
    setDispatching(true);
    setDispErr(null);
    const res = await fetch('/api/admin/dispatches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rider_username: selRider, cash_php: +cashPhp, notes: notes || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDispErr(data.detail ?? data.error ?? 'Failed to dispatch');
    } else {
      setSelRider(''); setCashPhp(''); setNotes('');
      await fetchDispatches();
    }
    setDispatching(false);
  }

  async function handleReturn(id: string) {
    setReturning(id);
    await fetch(`/api/admin/dispatches/${id}/return`, { method: 'PATCH' });
    await fetchDispatches();
    setReturning(null);
  }

  const inField   = dispatches.filter(d => d.status === 'IN_FIELD');
  const returned  = dispatches.filter(d => d.status === 'RETURNED');
  const riderTxns = data.recentTransactions.filter(t => t.source === 'RIDER');

  // Riders not yet dispatched today
  const dispatchedUsernames = new Set(inField.map(d => d.rider_username));
  const availableRiders = riders.filter(r => !dispatchedUsernames.has(r.username));

  const pad = isMobile ? '16px' : '28px 32px';

  return (
    <div style={{ ...S.page, padding: pad, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── DISPATCH FORM ── */}
      <div style={S.card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🏍️</span>
          <span style={{ ...S.syne, fontSize: 13, fontWeight: 700, color: 'var(--accent-sky)' }}>Dispatch a Rider</span>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 0 }}>
            <label style={{ ...S.mono, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>RIDER</label>
            <select
              value={selRider}
              onChange={e => setSelRider(e.target.value)}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: selRider ? 'var(--text-strong)' : 'var(--text-muted)', ...S.mono, fontSize: 12, outline: 'none' }}
            >
              <option value="">— Select rider —</option>
              {availableRiders.map(r => (
                <option key={r.username} value={r.username}>{r.full_name || r.username} ({r.username})</option>
              ))}
              {availableRiders.length === 0 && riders.length > 0 && (
                <option disabled>All riders already dispatched today</option>
              )}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ ...S.mono, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>STARTING CASH (PHP)</label>
            <input
              type="number"
              value={cashPhp}
              onChange={e => setCashPhp(e.target.value)}
              placeholder="0.00"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-strong)', ...S.mono, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={{ ...S.mono, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>NOTES (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Area: Mactan"
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-strong)', ...S.mono, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={handleDispatch}
            disabled={!selRider || !cashPhp || +cashPhp <= 0 || dispatching}
            style={{
              padding: '10px 20px', borderRadius: 8, whiteSpace: 'nowrap',
              background: (!selRider || !cashPhp || +cashPhp <= 0) ? 'var(--border-subtle)' : 'rgba(95,183,212,0.2)',
              color: (!selRider || !cashPhp || +cashPhp <= 0) ? 'var(--text-muted)' : 'var(--accent-sky)',
              border: `1px solid ${(!selRider || !cashPhp || +cashPhp <= 0) ? 'var(--border-subtle)' : 'rgba(95,183,212,0.4)'}`,
              ...S.mono, fontSize: 11, cursor: (!selRider || !cashPhp || +cashPhp <= 0) ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            {dispatching ? 'DISPATCHING...' : 'DISPATCH'}
          </button>
        </div>
        {dispErr && (
          <div style={{ margin: '0 20px 16px', padding: '8px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, ...S.mono, fontSize: 11, color: '#f87171' }}>
            {dispErr}
          </div>
        )}
      </div>

      {/* ── IN FIELD ── */}
      {inField.length > 0 && (
        <div style={S.card}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-sky)', boxShadow: '0 0 6px #a78bfa' }} />
            <span style={{ ...S.mono, fontSize: 10, color: 'var(--accent-sky)', letterSpacing: '0.12em' }}>IN FIELD — {inField.length}</span>
          </div>
          {inField.map((d, i) => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
              padding: '14px 20px', borderBottom: i < inField.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...S.syne, fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{d.rider_name}</div>
                  <div style={{ ...S.mono, fontSize: 10, color: 'var(--text-muted)' }}>{d.rider_username}</div>
                </div>
                <div>
                  <div style={{ ...S.mono, fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>STARTING CASH</div>
                  <div style={{ ...S.syne, fontSize: 14, fontWeight: 700, color: 'var(--accent-sky)' }}>{php(d.cash_php)}</div>
                </div>
                {d.dispatch_time && (
                  <div>
                    <div style={{ ...S.mono, fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>DISPATCHED</div>
                    <div style={{ ...S.mono, fontSize: 12, color: 'var(--text-strong)' }}>{d.dispatch_time}</div>
                  </div>
                )}
                {d.notes && (
                  <div style={{ ...S.mono, fontSize: 11, color: 'var(--text-muted)' }}>{d.notes}</div>
                )}
              </div>
              <button
                onClick={() => handleReturn(d.id)}
                disabled={returning === d.id}
                style={{
                  padding: '7px 16px', borderRadius: 7, border: '1px solid rgba(61,199,173,0.35)',
                  background: 'rgba(61,199,173,0.08)', color: 'var(--teal-300)',
                  ...S.mono, fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em',
                }}
              >
                {returning === d.id ? 'MARKING...' : 'MARK RETURNED'}
              </button>
            </div>
          ))}
        </div>
      )}

      {inField.length === 0 && (
        <div style={{ ...S.card, padding: '24px 20px', textAlign: 'center', ...S.mono, fontSize: 11, color: 'var(--text-muted)' }}>
          No riders currently in the field.
        </div>
      )}

      {/* ── RETURNED TODAY ── */}
      {returned.length > 0 && (
        <div style={S.card}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ ...S.mono, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>RETURNED TODAY — {returned.length}</span>
          </div>
          {returned.map((d, i) => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
              padding: '12px 20px', borderBottom: i < returned.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ ...S.mono, fontSize: 12, color: 'var(--text-muted)' }}>{d.rider_name} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({d.rider_username})</span></div>
                </div>
                <div style={{ ...S.mono, fontSize: 11, color: 'var(--text-muted)' }}>
                  {d.dispatch_time && `Dispatched ${d.dispatch_time}`}
                  {d.dispatch_time && d.return_time && ' → '}
                  {d.return_time && `Returned ${d.return_time}`}
                </div>
              </div>
              <div style={{ ...S.syne, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{php(d.cash_php)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── RIDER TRANSACTIONS TODAY ── */}
      {riderTxns.length > 0 && (
        <div style={S.card}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ ...S.mono, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>RIDER TRANSACTIONS TODAY — {riderTxns.length}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '60px 56px 64px 90px 1fr 100px 90px' : '60px 56px 64px 90px 1fr 100px', padding: '8px 20px', borderBottom: '1px solid var(--border)', ...S.mono, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', minWidth: isAdmin ? 580 : 490 }}>
              <span>TIME</span><span>TYPE</span><span>CCY</span><span>FOREIGN</span><span>RATE / CUSTOMER</span><span>PHP</span>{isAdmin && <span>THAN</span>}
            </div>
            {riderTxns.map((t, i) => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: isAdmin ? '60px 56px 64px 90px 1fr 100px 90px' : '60px 56px 64px 90px 1fr 100px', padding: '10px 20px', borderBottom: i < riderTxns.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', gap: 8, minWidth: isAdmin ? 580 : 490, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                <span style={{ ...S.mono, fontSize: 10, color: 'var(--text-muted)' }}>{t.time}</span>
                <span style={{ ...S.mono, fontSize: 10, fontWeight: 700, color: t.type === 'BUY' ? 'var(--accent-sky)' : 'var(--accent-gold)' }}>{t.type}</span>
                <span style={{ ...S.mono, fontSize: 12, color: 'var(--text-strong)' }}>{t.currency}</span>
                <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-strong)' }}>{t.foreignAmt.toLocaleString()}</span>
                <span style={{ ...S.mono, fontSize: 10, color: 'var(--text-muted)' }}>{t.rate} {t.customer ? `· ${t.customer}` : ''}</span>
                <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-strong)', fontWeight: 500 }}>{php(t.phpAmt)}</span>
                {isAdmin && <span style={{ ...S.mono, fontSize: 11, color: t.type === 'SELL' ? 'var(--teal-300)' : 'var(--text-muted)' }}>{t.type === 'SELL' ? '+' + php(t.than) : '—'}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RateBoardTab({ data }: { data: DashboardSummary }) {
  const w = useWindowWidth();
  const isMobile = w < 768;
  const { positions } = data;
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(todayLongPHT());
  }, []);
  const half  = Math.ceil(positions.length / 2);
  const left  = positions.slice(0, half);
  const right = positions.slice(half);
  return (
    <div style={{ ...S.page, padding: isMobile ? '16px' : '28px 32px' }}>
      <div style={{ ...S.card, padding:'24px 32px', display:'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent:'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 16 : 0, border:'1px solid rgba(61,199,173,0.22)', animation:'fadeUp 0.3s ease both' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:46, height:46, borderRadius:12, background:'linear-gradient(135deg,var(--teal-300),var(--teal-600))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#000', fontFamily:'var(--font-sans)' }}>K</div>
          <div>
            <div style={{ ...S.syne, fontSize:20, fontWeight:800, color:'var(--text-strong)', letterSpacing:'-0.02em' }}>Kedco FX</div>
            <div style={{ ...S.mono, fontSize:10, color:'var(--text-muted)', marginTop:1 }}>Pusok · Lapu-Lapu City · Cebu</div>
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ ...S.syne, fontSize:20, fontWeight:800, color:'var(--teal-300)', letterSpacing:'-0.01em' }}>Currency Exchange Rates</div>
          <div style={{ ...S.mono, fontSize:10, color:'var(--text-muted)', marginTop:3, letterSpacing:'0.08em' }}>{today.toUpperCase()}</div>
        </div>
        <div style={{ ...S.mono, fontSize:10, color:'var(--text-muted)', textAlign:'right', lineHeight:1.8 }}>
          <div style={{ color:'var(--teal-300)', fontSize:11, fontWeight:700 }}>PUBLISHED RATES</div>
          <div>Rates are per 1 unit of foreign currency</div>
          <div>in Philippine Peso (PHP)</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:14, animation:'fadeUp 0.4s ease 0.1s both' }}>
        {[left, right].map((col, ci) => (
          <div key={ci} style={S.card}>
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 110px 110px', padding:'9px 20px', borderBottom:'1px solid rgba(61,199,173,0.18)', background:'rgba(61,199,173,0.06)', gap:14, alignItems:'center' }}>
              <span style={{ ...S.mono, fontSize:9, color:'var(--teal-300)', letterSpacing:'0.18em' }}>FLAG</span>
              <span style={{ ...S.mono, fontSize:9, color:'var(--teal-300)', letterSpacing:'0.18em' }}>CURRENCY</span>
              <span style={{ ...S.mono, fontSize:9, color:'var(--accent-sky)', letterSpacing:'0.18em', textAlign:'right' }}>BUY</span>
              <span style={{ ...S.mono, fontSize:9, color:'var(--teal-300)', letterSpacing:'0.18em', textAlign:'right' }}>SELL</span>
            </div>
            {col.map((c, i) => (
              <div key={c.code} style={{ display:'grid', gridTemplateColumns:'auto 1fr 110px 110px', padding:'13px 20px', borderBottom: i < col.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.014)', gap:14, alignItems:'center' }}>
                <span style={{ fontSize:22, lineHeight:1, flexShrink:0 }}>{c.flag}</span>
                <div>
                  <span style={{ ...S.syne, fontSize:13, fontWeight:700, color:'var(--text-strong)', letterSpacing:'0.01em' }}>{c.name.toUpperCase()}</span>
                  <span style={{ ...S.mono, fontSize:9, color:'var(--text-muted)', marginLeft:8 }}>{c.code}</span>
                </div>
                <span style={{ ...S.mono, fontSize:15, fontWeight:600, color:'var(--accent-sky)', textAlign:'right' }}>{fmt(c.todayBuyRate, c.decimalPlaces)}</span>
                <span style={{ ...S.mono, fontSize:15, fontWeight:700, color:'var(--teal-300)', textAlign:'right' }}>{fmt(c.todaySellRate, c.decimalPlaces)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ ...S.mono, fontSize:10, color:'var(--text-muted)', textAlign:'center', paddingBottom:8, letterSpacing:'0.08em' }}>
        RATES ARE SUBJECT TO CHANGE WITHOUT PRIOR NOTICE · FOR INQUIRIES CONTACT THE COUNTER
      </div>
    </div>
  );
}

const BRANCHES = ['PUSOK', 'SM', 'AYALA', 'MAIN'];

function TrackerTab({ data }: { data: DashboardSummary }) {
  const w = useWindowWidth();
  const isMobile = w < 768;
  const { positions } = data;
  const [role, setRole]         = useState<'ADMIN'|'CASHIER'>('CASHIER');
  const [view, setView]         = useState<'balances'|'passbook'>('balances');
  const [entries, setEntries]   = useState<TrackerEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [branch, setBranch]     = useState('PUSOK');
  const [f, setF] = useState({ customer:'', currency:'USD', foreignAmt:'', cashPaid:'', checkNo:'', bank:'' });
  const [pbData, setPbData]     = useState<PbBank[]>([]);
  const [pbSel, setPbSel]       = useState<number | null>(null);
  const [pbLoading, setPbLoading] = useState(false);

  useEffect(() => {
    try { const e = localStorage.getItem('kedco-tracker'); if (e) setEntries(JSON.parse(e)); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem('kedco-tracker', JSON.stringify(entries)); }, [entries]);

  useEffect(() => {
    if (view !== 'passbook') return;
    setPbLoading(true);
    fetch('/api/admin/passbook')
      .then(r => r.ok ? r.json() : [])
      .then((d: PbBank[]) => { setPbData(d); if (d.length && pbSel === null) setPbSel(d[0].bank_id); })
      .finally(() => setPbLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const rate     = positions.find(c => c.code === f.currency)?.todaySellRate ?? 0;
  const totalPhp = (parseFloat(f.foreignAmt) || 0) * rate;
  const checkAmt = Math.max(0, totalPhp - (parseFloat(f.cashPaid) || 0));

  const addEntry = () => {
    if (!f.customer.trim() || !f.foreignAmt) return;
    const isPaid = checkAmt <= 0;
    const entry: TrackerEntry = {
      id: `CHK-${Date.now()}`, date: new Date().toLocaleDateString('en-PH'),
      customer: f.customer, currency: f.currency,
      foreignAmt: parseFloat(f.foreignAmt), rate, totalPhp,
      cashPaid: parseFloat(f.cashPaid) || 0, checkAmt,
      checkNo: f.checkNo, bank: f.bank,
      status: isPaid ? 'FULLY PAID' : 'PENDING', branch,
    };
    setEntries(prev => [entry, ...prev]);
    setF({ customer:'', currency:'USD', foreignAmt:'', cashPaid:'', checkNo:'', bank:'' });
    setShowForm(false);
  };

  const markDeposited = (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'FULLY PAID' as const, depositedDate: new Date().toLocaleDateString('en-PH') } : e));
  };

  const pending      = entries.filter(e => e.status === 'PENDING');
  const paid         = entries.filter(e => e.status === 'FULLY PAID');
  const pendingTotal = pending.reduce((s, e) => s + e.checkAmt, 0);
  const pbBank       = pbData.find(b => b.bank_id === pbSel) ?? null;
  const pbGrandTotal = pbData.reduce((s, b) => s + b.total, 0);

  const inp = (label: string, key: keyof typeof f, opts?: { type?: string; placeholder?: string }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.12em' }}>{label}</label>
      <input
        type={opts?.type||'text'}
        placeholder={opts?.placeholder||''}
        value={f[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))}
        style={{ background:'var(--bg-card-2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', color:'var(--text-strong)', fontFamily:'var(--font-mono)', fontSize:12, outline:'none', width:'100%' }}
      />
    </div>
  );

  return (
    <div style={{ ...S.page, padding: isMobile ? '16px' : '28px 32px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6 }}>
          {(['balances','passbook'] as const).map(v => (
            <button key={v} onClick={()=>setView(v)} style={{ padding:'7px 18px', borderRadius:6, border:`1px solid ${view===v?'var(--teal-300)':'var(--border-subtle)'}`, background:view===v?'rgba(61,199,173,0.1)':'transparent', color:view===v?'var(--teal-300)':'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.1em', cursor:'pointer', textTransform:'uppercase' }}>{v}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-card-2)', border:'1px solid var(--border)', borderRadius:8, padding:'4px' }}>
            {(['CASHIER','ADMIN'] as const).map(r => (
              <button key={r} onClick={()=>setRole(r)} style={{ padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.08em', background: role===r ? (r==='ADMIN'?'rgba(212,166,74,0.2)':'rgba(95,183,212,0.2)') : 'transparent', color: role===r ? (r==='ADMIN'?'var(--accent-gold)':'var(--accent-sky)') : 'var(--text-muted)', transition:'all 0.15s' }}>
                {r==='ADMIN' ? '🔐 ADMIN' : '🖥️ CASHIER'}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', letterSpacing:'0.1em' }}>BRANCH</span>
            {BRANCHES.map(b => (
              <button key={b} onClick={()=>setBranch(b)} style={{ padding:'5px 12px', borderRadius:5, border:`1px solid ${branch===b?'var(--accent-sky)':'var(--border-subtle)'}`, background:branch===b?'rgba(95,183,212,0.1)':'transparent', color:branch===b?'var(--accent-sky)':'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:10, cursor:'pointer' }}>{b}</button>
            ))}
          </div>
        </div>
      </div>

      {view === 'balances' && (
        <>
          {role === 'ADMIN' && <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap:14 }}>
            {[
              { label:'PENDING CHECKS', val:php(pendingTotal), sub:`${pending.length} customer${pending.length!==1?'s':''} with balance`, color:'var(--accent-coral)' },
              { label:'FULLY PAID TODAY', val:String(paid.length), sub:'All cleared', color:'var(--teal-300)' },
              { label:'TOTAL ENTRIES', val:String(entries.length), sub:'Cumulative', color:'var(--accent-sky)' },
            ].map(c => (
              <div key={c.label} style={{ ...S.card, padding:'18px 22px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${c.color},transparent)` }}/>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.15em', marginBottom:6 }}>{c.label}</div>
                <div style={{ fontFamily:'var(--font-sans)', fontSize:26, fontWeight:800, color:c.color, lineHeight:1, marginBottom:4 }}>{c.val}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.sub}</div>
              </div>
            ))}
          </div>}

          <div>
            <button onClick={()=>setShowForm(s=>!s)} style={{ padding:'8px 20px', borderRadius:7, border:'1px solid rgba(61,199,173,0.35)', background:'rgba(61,199,173,0.08)', color:'var(--teal-300)', fontFamily:'var(--font-sans)', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:'0.02em' }}>
              {showForm ? '✕ Cancel' : '+ Add Entry'}
            </button>
            {showForm && (
              <div style={{ ...S.card, padding:'22px 24px', marginTop:12, border:'1px solid rgba(61,199,173,0.2)', animation:'fadeUp 0.25s ease both' }}>
                <div style={{ fontFamily:'var(--font-sans)', fontSize:13, fontWeight:700, marginBottom:16, color:'var(--teal-300)' }}>New Customer Entry</div>
                <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 120px 140px 140px 140px', gap:12, marginBottom:12 }}>
                  {inp('CUSTOMER NAME', 'customer', { placeholder:'e.g. Nancy' })}
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <label style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.12em' }}>CURRENCY</label>
                    <select value={f.currency} onChange={e=>setF(p=>({...p,currency:e.target.value}))} style={{ background:'var(--bg-card-2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', color:'var(--text-strong)', fontFamily:'var(--font-mono)', fontSize:12, outline:'none' }}>
                      {positions.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                  </div>
                  {inp('FOREIGN AMT', 'foreignAmt', { type:'number', placeholder:'e.g. 100000' })}
                  {inp('CASH PAID (PHP)', 'cashPaid', { type:'number', placeholder:'e.g. 100000' })}
                  <div style={{ display:'flex', flexDirection:'column', gap:4, justifyContent:'flex-end' }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.12em' }}>COMPUTED</div>
                    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px' }}>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)' }}>Rate: {rate.toFixed(4)}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent-gold)' }}>Total: {php(totalPhp)}</div>
                      <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color: checkAmt > 0 ? 'var(--accent-coral)' : 'var(--teal-300)' }}>Check: {php(checkAmt)}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                  {inp('CHECK NO.', 'checkNo', { placeholder:'e.g. 001234' })}
                  {inp('BANK', 'bank', { placeholder:'e.g. BDO, BPI...' })}
                </div>
                <button onClick={addEntry} style={{ padding:'9px 24px', borderRadius:7, border:'none', background:'linear-gradient(135deg,var(--teal-300),var(--teal-600))', color:'#000', fontFamily:'var(--font-sans)', fontSize:12, fontWeight:800, cursor:'pointer', letterSpacing:'0.02em' }}>Save Entry</button>
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div style={S.card}>
              <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontFamily:'var(--font-sans)', fontSize:13, fontWeight:700, color:'var(--accent-coral)' }}>⏳ Pending Checks</div>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent-coral)' }}>{php(pendingTotal)} outstanding</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 110px 110px 110px 120px 120px', padding:'9px 22px', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.1em', gap:10, minWidth:760 }}>
                  <span>CUSTOMER</span><span>CCY</span><span>FOREIGN AMT</span><span>PHP TOTAL</span><span>CASH PAID</span><span>CHECK AMT</span><span>CHECK / BANK</span><span></span>
                </div>
                {pending.map((e, i) => (
                  <div key={e.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 110px 110px 110px 120px 120px', padding:'13px 22px', borderBottom:i<pending.length-1?'1px solid var(--border)':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:10, minWidth:760 }}>
                    <div><div style={{ fontFamily:'var(--font-sans)', fontSize:13, fontWeight:700 }}>{e.customer}</div><div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)' }}>{e.date}</div></div>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent-gold)', fontWeight:600 }}>{e.currency}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>{e.foreignAmt.toLocaleString()}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>{php(e.totalPhp)}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--teal-300)' }}>{php(e.cashPaid)}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent-coral)', fontWeight:600 }}>{php(e.checkAmt)}</span>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:10 }}><div style={{ color:'var(--text-strong)' }}>{e.checkNo||'—'}</div><div style={{ color:'var(--text-muted)' }}>{e.bank||'—'}</div></div>
                    <button onClick={()=>markDeposited(e.id)} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid rgba(61,199,173,0.4)', background:'rgba(61,199,173,0.08)', color:'var(--teal-300)', fontFamily:'var(--font-mono)', fontSize:10, cursor:'pointer', letterSpacing:'0.05em' }}>MARK DEPOSITED</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {paid.length > 0 && (
            <div style={S.card}>
              <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--border)' }}><div style={{ fontFamily:'var(--font-sans)', fontSize:13, fontWeight:700, color:'var(--teal-300)' }}>✅ Fully Paid</div></div>
              <div style={{ overflowX:'auto' }}>
                {paid.map((e, i) => (
                  <div key={e.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 110px 110px 140px', padding:'11px 22px', borderBottom:i<paid.length-1?'1px solid var(--border)':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:10, minWidth:640 }}>
                    <div><div style={{ fontFamily:'var(--font-sans)', fontSize:12, fontWeight:700, color:'var(--text-muted)' }}>{e.customer}</div><div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)' }}>{e.date}{e.depositedDate ? ` · deposited ${e.depositedDate}` : ''}</div></div>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-muted)' }}>{e.currency}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>{e.foreignAmt.toLocaleString()}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>{php(e.totalPhp)}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>{php(e.cashPaid)}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--teal-300)', padding:'3px 10px', background:'rgba(61,199,173,0.08)', borderRadius:20, border:'1px solid rgba(61,199,173,0.2)', textAlign:'center' }}>FULLY PAID</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entries.length === 0 && (
            <div style={{ ...S.card, padding:'48px', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
              <div style={{ fontFamily:'var(--font-sans)', fontSize:15, fontWeight:700, marginBottom:6 }}>No entries yet</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>Click + Add Entry to log a customer transaction with check payment</div>
            </div>
          )}
        </>
      )}

      {view === 'passbook' && (
        <>
          {/* Grand total + link to full passbook */}
          <div style={{ ...S.card, padding:'24px 28px', border:'1px solid rgba(95,183,212,0.28)', position:'relative', overflow:'hidden', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div style={{ position:'absolute', top:-40, right:-40, width:130, height:130, borderRadius:'50%', background:'radial-gradient(circle,rgba(95,183,212,0.1) 0%,transparent 70%)', pointerEvents:'none' }}/>
            <div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', letterSpacing:'0.2em', marginBottom:8 }}>TOTAL ALL BANKS</div>
              <div style={{ fontFamily:'var(--font-sans)', fontSize:42, fontWeight:800, color:'var(--accent-sky)', lineHeight:1, marginBottom:8 }}>{pbLoading ? '…' : php(pbGrandTotal)}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>{pbData.length} bank{pbData.length !== 1 ? 's' : ''} · {pbData.reduce((s,b)=>s+b.entries.length,0)} deposit{pbData.reduce((s,b)=>s+b.entries.length,0)!==1?'s':''}</div>
            </div>
            <a href="/admin/passbook" style={{ fontFamily:'var(--font-mono)', fontSize:10, padding:'6px 16px', borderRadius:6, border:'1px solid rgba(95,183,212,0.35)', color:'var(--accent-sky)', textDecoration:'none', whiteSpace:'nowrap' }}>Full View →</a>
          </div>

          {/* Bank tabs */}
          {pbData.length > 0 && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {pbData.map(b => (
                <button key={b.bank_id} onClick={() => setPbSel(b.bank_id)}
                  style={{ fontFamily:'var(--font-mono)', fontSize:10, padding:'7px 16px', borderRadius:7, cursor:'pointer', letterSpacing:'0.08em', border:`1px solid ${pbSel===b.bank_id?'var(--accent-sky)':'var(--border-subtle)'}`, background:pbSel===b.bank_id?'rgba(95,183,212,0.1)':'transparent', color:pbSel===b.bank_id?'var(--accent-sky)':'var(--text-muted)' }}>
                  {b.bank_code} <span style={{ marginLeft:6 }}>{php(b.total)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Selected bank ledger */}
          {pbBank && (
            <div style={S.card}>
              <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontFamily:'var(--font-sans)', fontSize:13, fontWeight:700 }}>{pbBank.bank_name}</div>
                <span style={{ fontFamily:'var(--font-sans)', fontSize:14, fontWeight:800, color:'var(--accent-sky)' }}>{php(pbBank.total)}</span>
              </div>
              {pbBank.entries.length === 0 ? (
                <div style={{ padding:'40px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>No deposits yet.</div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 120px 130px', padding:'9px 22px', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', letterSpacing:'0.1em', gap:12 }}>
                    <span>DATE</span><span>NOTES</span><span>LOGGED BY</span><span style={{ textAlign:'right' }}>AMOUNT</span>
                  </div>
                  {[...pbBank.entries].reverse().map((e, i) => (
                    <div key={e.id} style={{ display:'grid', gridTemplateColumns:'100px 1fr 120px 130px', padding:'12px 22px', borderBottom:i<pbBank.entries.length-1?'1px solid var(--border)':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:12 }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)' }}>{new Date(e.deposited_date+'T00:00:00+08:00').toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'})}</span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color: e.notes ? 'var(--text-strong)' : 'var(--text-muted)', fontStyle: e.notes ? 'normal' : 'italic' }}>{e.notes ?? '—'}</span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)' }}>{e.logged_by}</span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--accent-sky)', fontWeight:600, textAlign:'right' }}>{php(e.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 120px 130px', padding:'13px 22px', borderTop:'2px solid rgba(95,183,212,0.35)', background:'rgba(95,183,212,0.06)', gap:12, alignItems:'center' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', gridColumn:'span 3' }}>BALANCE</span>
                    <span style={{ fontFamily:'var(--font-sans)', fontSize:15, fontWeight:800, color:'var(--accent-sky)', textAlign:'right' }}>{php(pbBank.total)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {!pbLoading && pbData.length === 0 && (
            <div style={{ ...S.card, padding:'48px', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📒</div>
              <div style={{ fontFamily:'var(--font-sans)', fontSize:15, fontWeight:700, marginBottom:6 }}>No banks set up yet</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>Add banks in Admin → Manage Banks, then cashiers can log deposits.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SetupStep({ done, label, detail, href, actionLabel }: {
  done: boolean; label: string; detail: string; href: string; actionLabel: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
      background: done ? 'rgba(61,199,173,0.05)' : 'rgba(212,166,74,0.06)',
      border: `1px solid ${done ? 'rgba(61,199,173,0.2)' : 'rgba(212,166,74,0.25)'}`,
      borderRadius: 10,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
        background: done ? 'rgba(61,199,173,0.15)' : 'rgba(212,166,74,0.12)',
        color: done ? 'var(--teal-300)' : 'var(--accent-gold)', fontWeight: 800,
      }}>
        {done ? '✓' : '!'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: done ? 'var(--teal-300)' : 'var(--text-strong)', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {detail}
        </div>
      </div>
      {!done && (
        <a href={href} style={{
          flexShrink: 0, padding: '7px 14px', borderRadius: 8,
          background: 'rgba(212,166,74,0.12)', border: '1px solid rgba(212,166,74,0.3)',
          color: 'var(--accent-gold)', fontFamily: "'DM Mono',monospace", fontSize: 11,
          fontWeight: 700, textDecoration: 'none', letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}>
          {actionLabel} →
        </a>
      )}
    </div>
  );
}

export default function DashboardShell({ data, role }: { data: DashboardSummary; role: string }) {
  const [active, setActive] = useState('Dashboard');
  useIdleTimeout(20);

  const ratesSet   = data.positions.some(p => p.todayBuyRate > 0 || p.todaySellRate > 0);
  const carryInSet = data.positions.length > 0;
  const needsSetup = role === 'admin' && (!ratesSet || !carryInSet);

  return (
    <div style={{ minHeight:'100vh', position:'relative', zIndex:1, overflowX:'hidden', maxWidth:'100vw' }}>
      <DashboardTourAutoStart />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ticker { from { transform:translateX(0); } to { transform:translateX(-50%); } }
      `}</style>

      {/* ── DAILY SETUP GATE (blocks dashboard until rates + carry-in are ready) ── */}
      {needsSetup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(7,9,13,0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 16, padding: 36, width: '100%', maxWidth: 480,
          }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--accent-gold)', letterSpacing: '0.2em', marginBottom: 8 }}>
              DAILY SETUP REQUIRED
            </div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
              Before cashiers can transact
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.7 }}>
              Complete these steps first. Cashiers are blocked until both are done.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              <SetupStep
                done={carryInSet}
                label="Opening positions set"
                detail={carryInSet ? 'Carry-in stock is ready for today.' : "No positions for today — run yesterday's EOD or set opening stock manually."}
                href="/admin/positions"
                actionLabel="Set Positions"
              />
              <SetupStep
                done={ratesSet}
                label="Today's rates set"
                detail={ratesSet ? 'Buy/sell rates are live for cashiers.' : 'No rates set for today — cashiers cannot process any transactions.'}
                href="/admin/rates"
                actionLabel="Set Rates"
              />
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-muted)', fontFamily: "'DM Mono',monospace",
                fontSize: 12, cursor: 'pointer', letterSpacing: '0.1em',
              }}
            >
              REFRESH
            </button>
          </div>
        </div>
      )}

      <Nav active={active} set={setActive} role={role}/>
      <Ticker positions={data.positions}/>
      {active==='Dashboard'    && <DashboardTab    data={data} role={role}/>}
      {active==='Positions'    && <PositionsTab    data={data}/>}
      {active==='Transactions' && <TransactionsTab data={data} role={role}/>}
      {active==='Rider'        && <RiderTab        data={data} role={role}/>}
      {active==='Rate Board'   && <RateBoardTab    data={data}/>}
      {active==='Tracker'      && <TrackerTab      data={data}/>}
    </div>
  );
}
