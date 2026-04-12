'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardSummary, CurrencyPosition, Transaction } from '@/lib/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const php = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');
const fmt = (rate: number, dp: number) => rate.toFixed(dp);

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
interface PassbookEntry {
  id: string; date: string; amount: number;
  description: string; refId?: string; branch: string;
}

const S: Record<string, React.CSSProperties> = {
  nav:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:'56px', borderBottom:'1px solid #1e2230', background:'rgba(15,17,23,0.96)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100, fontFamily:"'Syne',sans-serif" },
  ticker: { overflow:'hidden', borderBottom:'1px solid #1e2230', background:'#0f1117', padding:'8px 0' },
  page:   { padding:'28px 32px', display:'flex', flexDirection:'column', gap:'22px', position:'relative', zIndex:1 },
  card:   { background:'#0f1117', border:'1px solid #1e2230', borderRadius:'14px', overflow:'hidden' },
  mono:   { fontFamily:"'DM Mono',monospace" },
  syne:   { fontFamily:"'Syne',sans-serif" },
};

function Ticker({ positions }: { positions: CurrencyPosition[] }) {
  const items = positions.slice(0, 9).flatMap(c => [
    `${c.flag} ${c.code}  B:${fmt(c.todayBuyRate, c.decimalPlaces)}  S:${fmt(c.todaySellRate, c.decimalPlaces)}`
  ]);
  return (
    <div style={S.ticker}>
      <div style={{ display:'flex', gap:'48px', whiteSpace:'nowrap', animation:'ticker 30s linear infinite', fontFamily:"'DM Mono',monospace", fontSize:'11px', color:'#4a5468' }}>
        {[...items,...items].map((it,i) => <span key={i} style={{ flexShrink:0 }}><span style={{ color:'#00d4aa', marginRight:6 }}>◆</span>{it}</span>)}
      </div>
    </div>
  );
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Nav({ active, set }: { active:string; set:(s:string)=>void }) {
  const router = useRouter();
  const now = useLiveClock();
  const dateStr = now.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
  const tabs = ['Dashboard','Positions','Transactions','Rider','Rate Board','Tracker'];

  async function handleLogout() {
    await fetch('/api/auth/logout', { method:'POST' });
    router.push('/login');
  }

  return (
    <nav style={S.nav}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#e2e6f0', letterSpacing:'-0.01em' }}>Kedco FX</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', marginTop:-2 }}>Pusok · Lapu-Lapu City</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:4 }}>
        {tabs.map(t => (
          <button key={t} onClick={()=>set(t)} style={{ padding:'6px 16px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:"'Syne',sans-serif", letterSpacing:'0.01em', background: active===t ? 'rgba(0,212,170,0.12)' : 'transparent', color: active===t ? '#00d4aa' : '#4a5468', transition:'all 0.15s' }}>{t}</button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#00d4aa', boxShadow:'0 0 8px #00d4aa88' }} />
        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#00d4aa' }}>LIVE</span>
        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468' }}>{dateStr} · {timeStr}</span>
        <a href="/admin" style={{ marginLeft:8, padding:'4px 12px', borderRadius:6, border:'1px solid rgba(0,212,170,0.25)', background:'rgba(0,212,170,0.06)', color:'#00d4aa', fontFamily:"'DM Mono',monospace", fontSize:10, cursor:'pointer', letterSpacing:'0.05em', textDecoration:'none' }}>ADMIN</a>
        <button onClick={handleLogout} style={{ padding:'4px 12px', borderRadius:6, border:'1px solid #1e2230', background:'transparent', color:'#4a5468', fontFamily:"'DM Mono',monospace", fontSize:10, cursor:'pointer', letterSpacing:'0.05em' }}>LOGOUT</button>
      </div>
    </nav>
  );
}

function DashboardTab({ data }: { data: DashboardSummary }) {
  const capitalGain = data.totalCapital - data.openingCapital;
  const capital = useCountUp(data.totalCapital, 1400);
  const gain    = useCountUp(capitalGain, 1400);
  const than    = useCountUp(data.totalThanToday, 1000);

  const chartData = [
    { t:'08:00', cap: data.openingCapital },
    { t:'18:43', cap: data.totalCapital },
  ];
  const pieData = [
    { name:'MAIN',     value: data.positions.filter(c=>c.category==='MAIN').reduce((s,c)=>s+c.stockValuePhp,0),   color:'#00d4aa' },
    { name:'2ND',      value: data.positions.filter(c=>c.category==='2ND').reduce((s,c)=>s+c.stockValuePhp,0),    color:'#5b8cff' },
    { name:'OTHERS',   value: data.positions.filter(c=>c.category==='OTHERS').reduce((s,c)=>s+c.stockValuePhp,0), color:'#f5a623' },
    { name:'PHP Cash', value: data.phpCash, color:'#a78bfa' },
  ];
  const buyCount  = data.recentTransactions.filter(t=>t.type==='BUY').length;
  const sellCount = data.recentTransactions.filter(t=>t.type==='SELL').length;

  return (
    <div style={S.page}>
      {/* HERO */}
      <div style={{ ...S.card, border:'1px solid rgba(0,212,170,0.28)', padding:'30px 32px', position:'relative', overflow:'hidden', animation:'fadeUp 0.4s ease both' }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,212,170,0.09) 0%, transparent 70%)', pointerEvents:'none' }} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:24, alignItems:'center' }}>
          <div>
            <div style={{ ...S.mono, fontSize:10, color:'#4a5468', letterSpacing:'0.2em', marginBottom:10 }}>TOTAL CAPITAL POSITION — PHP EQUIVALENT</div>
            <div style={{ ...S.syne, fontSize:'clamp(38px,5vw,58px)', fontWeight:800, color:'#00d4aa', lineHeight:1, letterSpacing:'-0.025em', marginBottom:12 }}>{php(capital)}</div>
            <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <span style={{ ...S.mono, fontSize:12, color:'#00d4aa', background:'rgba(0,212,170,0.1)', padding:'4px 12px', borderRadius:20, border:'1px solid rgba(0,212,170,0.2)' }}>+{php(gain)} vs opening {php(data.openingCapital)}</span>
              <span style={{ ...S.mono, fontSize:12, color:'#4a5468' }}>+{((capitalGain/data.openingCapital)*100).toFixed(2)}% today</span>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:190 }}>
            {[
              { label:'PHP CASH',       val:data.phpCash,         color:'#a78bfa' },
              { label:'FX STOCK VALUE', val:data.totalStockValue, color:'#5b8cff' },
              { label:'UNREALIZED GAIN',val:data.totalUnrealized, color:'#00d4aa', prefix:'+' },
            ].map(row => (
              <div key={row.label} style={{ background:'#161922', border:'1px solid #1e2230', borderRadius:10, padding:'12px 16px' }}>
                <div style={{ ...S.mono, fontSize:9, color:'#4a5468', marginBottom:3, letterSpacing:'0.12em' }}>{row.label}</div>
                <div style={{ ...S.mono, fontSize:14, color:row.color }}>{row.prefix||''}{php(row.val)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {[
          { label:'TODAY THAN (MARGIN)', val:php(than),                sub:'Counter + rider combined',             color:'#00d4aa', icon:'📈', d:100 },
          { label:'BOUGHT TODAY',        val:php(data.totalBoughtToday),sub:`${buyCount} transactions`,             color:'#5b8cff', icon:'💱', d:150 },
          { label:'SOLD TODAY',          val:php(data.totalSoldToday),  sub:`${sellCount} transactions`,            color:'#f5a623', icon:'💸', d:200 },
        ].map(card => (
          <div key={card.label} style={{ ...S.card, padding:'20px 22px', position:'relative', overflow:'hidden', animation:`fadeUp 0.5s ease ${card.d}ms both` }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${card.color},transparent)` }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <div style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.15em' }}>{card.label}</div>
              <span style={{ fontSize:16 }}>{card.icon}</span>
            </div>
            <div style={{ ...S.syne, fontSize:24, fontWeight:800, color:card.color, lineHeight:1, marginBottom:5 }}>{card.val}</div>
            <div style={{ fontSize:11, color:'#4a5468' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* CHART + PIE */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>
        <div style={{ ...S.card, padding:24, animation:'fadeUp 0.5s ease 0.3s both' }}>
          <div style={{ ...S.syne, fontSize:14, fontWeight:700, marginBottom:2 }}>Capital Movement Today</div>
          <div style={{ ...S.mono, fontSize:9, color:'#4a5468', marginBottom:18, letterSpacing:'0.15em' }}>PHP EQUIVALENT · REAL-TIME</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top:4, right:4, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.22}/>
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill:'#4a5468', fontSize:10, fontFamily:'DM Mono' }} axisLine={false} tickLine={false}/>
              <YAxis domain={['auto','auto']} tick={{ fill:'#4a5468', fontSize:10, fontFamily:'DM Mono' }} axisLine={false} tickLine={false} tickFormatter={v=>`₱${(v/1000).toFixed(0)}K`} width={54}/>
              <Tooltip contentStyle={{ background:'#161922', border:'1px solid #1e2230', borderRadius:8, fontFamily:'DM Mono', fontSize:11 }} labelStyle={{ color:'#4a5468' }} formatter={(v) => [php(Number(v ?? 0)), 'Capital']}/>
              <Area type="monotone" dataKey="cap" stroke="#00d4aa" strokeWidth={2} fill="url(#cg)" dot={false} activeDot={{ r:4, fill:'#00d4aa' }}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...S.card, padding:24, animation:'fadeUp 0.5s ease 0.35s both' }}>
          <div style={{ ...S.syne, fontSize:14, fontWeight:700, marginBottom:2 }}>Capital Mix</div>
          <div style={{ ...S.mono, fontSize:9, color:'#4a5468', marginBottom:14, letterSpacing:'0.15em' }}>BY CATEGORY</div>
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
                  <span style={{ ...S.mono, fontSize:10, color:'#4a5468' }}>{d.name}</span>
                </div>
                <span style={{ ...S.mono, fontSize:11 }}>{php(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RECENT TXN */}
      <div style={{ ...S.card, animation:'fadeUp 0.5s ease 0.4s both' }}>
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #1e2230', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ ...S.syne, fontSize:14, fontWeight:700 }}>Recent Transactions</div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em', marginTop:2 }}>COUNTER + RIDER · TODAY</div>
          </div>
          <span style={{ ...S.mono, fontSize:11, color:'#00d4aa' }}>{data.recentTransactions.length} today</span>
        </div>
        {data.recentTransactions.slice(0,6).map((t,i) => (
          <div key={t.id} style={{ display:'grid', gridTemplateColumns:'90px 58px 62px 70px 1fr 90px 80px', padding:'11px 24px', borderBottom:i<5?'1px solid #1e2230':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:10, fontSize:12 }}>
            <span style={{ ...S.mono, fontSize:10, color:'#4a5468' }}>{t.time}</span>
            <span style={{ ...S.mono, fontSize:10, textAlign:'center', padding:'2px 0', borderRadius:4, color:t.type==='BUY'?'#5b8cff':'#f5a623', background:t.type==='BUY'?'rgba(91,140,255,0.1)':'rgba(245,166,35,0.1)' }}>{t.type}</span>
            <span style={{ ...S.mono, fontSize:10, textAlign:'center', color:t.source==='RIDER'?'#a78bfa':'#4a5468' }}>{t.source==='RIDER'?'🏍️ RDR':'🖥️ CTR'}</span>
            <span style={{ ...S.mono, fontSize:12, color:'#f5a623', fontWeight:500 }}>{t.currency}</span>
            <span style={{ ...S.mono, fontSize:11, color:'#4a5468' }}>{t.foreignAmt.toLocaleString()} @ {t.rate}</span>
            <span style={{ ...S.mono, fontSize:12, color:'#e2e6f0', fontWeight:500, textAlign:'right' }}>{php(t.phpAmt)}</span>
            <span style={{ ...S.mono, fontSize:11, color:'#00d4aa', textAlign:'right' }}>{t.type==='SELL'?'+'+php(t.than):'—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PositionsTab({ data }: { data: DashboardSummary }) {
  const { positions } = data;
  const [filter, setFilter] = useState<'ALL'|'MAIN'|'2ND'|'OTHERS'>('ALL');
  const filtered = filter==='ALL' ? positions : positions.filter(c=>c.category===filter);
  return (
    <div style={S.page}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {(['MAIN','2ND','OTHERS'] as const).map(cat => {
          const items = positions.filter(c=>c.category===cat);
          return (
            <div key={cat} style={{ ...S.card, padding:'18px 20px' }}>
              <div style={{ ...S.mono, fontSize:9, color:'#4a5468', marginBottom:6, letterSpacing:'0.15em' }}>{cat} · {items.length} currencies</div>
              <div style={{ ...S.syne, fontSize:20, fontWeight:800, marginBottom:4 }}>{php(items.reduce((s,c)=>s+c.stockValuePhp,0))}</div>
              <div style={{ ...S.mono, fontSize:11, color:'#00d4aa' }}>+{php(items.reduce((s,c)=>s+c.unrealizedPHP,0))} unrealized</div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {(['ALL','MAIN','2ND','OTHERS'] as const).map(f => (
          <button key={f} onClick={()=>setFilter(f)} style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.1em', border:`1px solid ${filter===f?'#00d4aa':'#1e2230'}`, background:filter===f?'rgba(0,212,170,0.1)':'transparent', color:filter===f?'#00d4aa':'#4a5468' }}>{f}</button>
        ))}
      </div>
      <div style={S.card}>
        <div style={{ display:'grid', gridTemplateColumns:'130px 110px 120px 100px 100px 110px 100px', padding:'10px 20px', borderBottom:'1px solid #1e2230', fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4a5468', letterSpacing:'0.1em', gap:8 }}>
          <span>CURRENCY</span><span>STOCK QTY</span><span>AVG COST (PHP)</span><span>BUY RATE</span><span>SELL RATE</span><span>STOCK VALUE</span><span>UNREALIZED</span>
        </div>
        {filtered.map((c,i) => (
          <div key={c.code} style={{ display:'grid', gridTemplateColumns:'130px 110px 120px 100px 100px 110px 100px', padding:'13px 20px', borderBottom:i<filtered.length-1?'1px solid #1e2230':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:15 }}>{c.flag}</span>
              <div>
                <div style={{ ...S.mono, fontSize:12, color:'#f5a623', fontWeight:500 }}>{c.code}</div>
                <div style={{ ...S.mono, fontSize:9, color:'#4a5468' }}>{c.category}</div>
              </div>
            </div>
            <span style={{ ...S.mono, fontSize:11 }}>{c.totalQty.toLocaleString()}</span>
            <span style={{ ...S.mono, fontSize:11, color:'#4a5468' }}>{fmt(c.dailyAvgCost, c.decimalPlaces)}</span>
            <span style={{ ...S.mono, fontSize:11 }}>{fmt(c.todayBuyRate, c.decimalPlaces)}</span>
            <span style={{ ...S.mono, fontSize:11, color:'#00d4aa' }}>{fmt(c.todaySellRate, c.decimalPlaces)}</span>
            <span style={{ ...S.mono, fontSize:12, fontWeight:500 }}>{php(c.stockValuePhp)}</span>
            <span style={{ ...S.mono, fontSize:11, color:'#00d4aa' }}>+{php(c.unrealizedPHP)}</span>
          </div>
        ))}
        <div style={{ display:'grid', gridTemplateColumns:'130px 110px 120px 100px 100px 110px 100px', padding:'12px 20px', borderTop:'1px solid #1e2230', background:'rgba(167,139,250,0.04)', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:15 }}>🇵🇭</span><div><div style={{ ...S.mono, fontSize:12, color:'#a78bfa', fontWeight:500 }}>PHP</div><div style={{ ...S.mono, fontSize:9, color:'#4a5468' }}>CASH</div></div></div>
          <span style={{ ...S.mono, fontSize:11, color:'#4a5468', gridColumn:'span 4' }}>Cash on hand</span>
          <span style={{ ...S.mono, fontSize:12, color:'#a78bfa', fontWeight:500 }}>{php(data.phpCash)}</span>
          <span style={{ ...S.mono, fontSize:11, color:'#4a5468' }}>—</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'130px 110px 120px 100px 100px 110px 100px', padding:'14px 20px', borderTop:'2px solid rgba(0,212,170,0.35)', background:'rgba(0,212,170,0.06)', gap:8, alignItems:'center' }}>
          <span style={{ ...S.syne, fontSize:13, fontWeight:800, color:'#00d4aa' }}>TOTAL</span>
          <span style={{ ...S.mono, fontSize:11, color:'#4a5468', gridColumn:'span 4' }}>{positions.length} currencies + PHP cash</span>
          <span style={{ ...S.mono, fontSize:14, color:'#00d4aa', fontWeight:500 }}>{php(data.totalCapital)}</span>
          <span style={{ ...S.mono, fontSize:12, color:'#00d4aa' }}>+{php(data.totalUnrealized)}</span>
        </div>
      </div>
    </div>
  );
}

function TransactionsTab({ data }: { data: DashboardSummary }) {
  const { recentTransactions: txns } = data;
  const [tF, setTF] = useState<'ALL'|'BUY'|'SELL'>('ALL');
  const [sF, setSF] = useState<'ALL'|'COUNTER'|'RIDER'>('ALL');
  const filtered = txns.filter(t=>(tF==='ALL'||t.type===tF)&&(sF==='ALL'||t.source===sF));
  return (
    <div style={S.page}>
      <div style={{ display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6 }}>
          {(['ALL','BUY','SELL'] as const).map(f => <button key={f} onClick={()=>setTF(f)} style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.1em', border:`1px solid ${tF===f?(f==='BUY'?'#5b8cff':f==='SELL'?'#f5a623':'#00d4aa'):'#1e2230'}`, background:tF===f?(f==='BUY'?'rgba(91,140,255,0.1)':f==='SELL'?'rgba(245,166,35,0.1)':'rgba(0,212,170,0.1)'):'transparent', color:tF===f?(f==='BUY'?'#5b8cff':f==='SELL'?'#f5a623':'#00d4aa'):'#4a5468' }}>{f}</button>)}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {(['ALL','COUNTER','RIDER'] as const).map(f => <button key={f} onClick={()=>setSF(f)} style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.1em', border:`1px solid ${sF===f?'#a78bfa':'#1e2230'}`, background:sF===f?'rgba(167,139,250,0.1)':'transparent', color:sF===f?'#a78bfa':'#4a5468' }}>{f==='COUNTER'?'🖥️ COUNTER':f==='RIDER'?'🏍️ RIDER':f}</button>)}
        </div>
        <div style={{ marginLeft:'auto', ...S.mono, fontSize:11, color:'#00d4aa' }}>THAN from filtered: {php(filtered.filter(t=>t.type==='SELL').reduce((s,t)=>s+t.than,0))}</div>
      </div>
      <div style={S.card}>
        <div style={{ display:'grid', gridTemplateColumns:'110px 70px 58px 80px 70px 1fr 90px 80px 130px', padding:'10px 20px', borderBottom:'1px solid #1e2230', fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4a5468', letterSpacing:'0.1em', gap:10 }}>
          <span>OR/REF</span><span>TIME</span><span>TYPE</span><span>SOURCE</span><span>CCY</span><span>AMT @ RATE</span><span>PHP TOTAL</span><span>THAN</span><span>CASHIER/CLIENT</span>
        </div>
        {filtered.map((t,i) => (
          <div key={t.id} style={{ display:'grid', gridTemplateColumns:'110px 70px 58px 80px 70px 1fr 90px 80px 130px', padding:'12px 20px', borderBottom:i<filtered.length-1?'1px solid #1e2230':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:10 }}>
            <span style={{ ...S.mono, fontSize:9, color:'#4a5468' }}>{t.id}</span>
            <span style={{ ...S.mono, fontSize:10, color:'#4a5468' }}>{t.time}</span>
            <span style={{ ...S.mono, fontSize:10, textAlign:'center', padding:'2px 0', borderRadius:4, color:t.type==='BUY'?'#5b8cff':'#f5a623', background:t.type==='BUY'?'rgba(91,140,255,0.1)':'rgba(245,166,35,0.1)' }}>{t.type}</span>
            <span style={{ ...S.mono, fontSize:10, color:t.source==='RIDER'?'#a78bfa':'#4a5468' }}>{t.source==='RIDER'?'🏍️ Rider':'🖥️ Ctr'}</span>
            <span style={{ ...S.mono, fontSize:13, color:'#f5a623', fontWeight:500 }}>{t.currency}</span>
            <span style={{ ...S.mono, fontSize:11, color:'#4a5468' }}>{t.foreignAmt.toLocaleString()} @ {t.rate}</span>
            <span style={{ ...S.mono, fontSize:12, fontWeight:500 }}>{php(t.phpAmt)}</span>
            <span style={{ ...S.mono, fontSize:11, color:t.type==='SELL'?'#00d4aa':'#4a5468' }}>{t.type==='SELL'?'+'+php(t.than):'—'}</span>
            <div style={{ ...S.mono, fontSize:10 }}><div>{t.cashier}</div>{t.customer&&<div style={{ color:'#4a5468' }}>{t.customer}</div>}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding:'40px', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468' }}>No transactions recorded yet today.</div>
        )}
      </div>
    </div>
  );
}

function RiderTab({ data }: { data: DashboardSummary }) {
  const riderTxns = data.recentTransactions.filter(t=>t.source==='RIDER');
  return (
    <div style={S.page}>
      <div style={{ ...S.card, padding:'32px', textAlign:'center', color:'#4a5468', fontFamily:"'DM Mono',monospace" }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🏍️</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, marginBottom:6, color:'#a78bfa' }}>Rider Management</div>
        <div style={{ fontSize:11 }}>Full rider dispatch tracking coming soon. Rider transactions below.</div>
      </div>
      {riderTxns.length > 0 && (
        <div style={S.card}>
          <div style={{ padding:'18px 24px', borderBottom:'1px solid #1e2230', fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700 }}>Rider Transactions Today</div>
          {riderTxns.map((t,i) => (
            <div key={t.id} style={{ display:'grid', gridTemplateColumns:'80px 58px 70px 100px 1fr 100px 90px', padding:'14px 24px', borderBottom:i<riderTxns.length-1?'1px solid #1e2230':'none', alignItems:'center', gap:12 }}>
              <span style={{ ...S.mono, fontSize:10, color:'#4a5468' }}>{t.time}</span>
              <span style={{ ...S.mono, fontSize:10, textAlign:'center', padding:'2px 0', borderRadius:4, color:t.type==='BUY'?'#5b8cff':'#f5a623', background:t.type==='BUY'?'rgba(91,140,255,0.1)':'rgba(245,166,35,0.1)' }}>{t.type}</span>
              <span style={{ ...S.mono, fontSize:13, color:'#f5a623', fontWeight:500 }}>{t.currency}</span>
              <span style={{ ...S.mono, fontSize:11, color:'#4a5468' }}>{t.foreignAmt.toLocaleString()}</span>
              <span style={{ ...S.mono, fontSize:11, color:'#4a5468' }}>{t.customer||'—'} @ {t.rate}</span>
              <span style={{ ...S.mono, fontSize:12, fontWeight:500 }}>{php(t.phpAmt)}</span>
              <span style={{ ...S.mono, fontSize:11, color:t.type==='SELL'?'#00d4aa':'#4a5468' }}>{t.type==='SELL'?'+'+php(t.than):'—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RateBoardTab({ data }: { data: DashboardSummary }) {
  const { positions } = data;
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const half  = Math.ceil(positions.length / 2);
  const left  = positions.slice(0, half);
  const right = positions.slice(half);
  return (
    <div style={S.page}>
      <div style={{ ...S.card, padding:'24px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid rgba(0,212,170,0.22)', animation:'fadeUp 0.3s ease both' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:46, height:46, borderRadius:12, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#000', fontFamily:"'Syne',sans-serif" }}>K</div>
          <div>
            <div style={{ ...S.syne, fontSize:20, fontWeight:800, color:'#e2e6f0', letterSpacing:'-0.02em' }}>Kedco FX</div>
            <div style={{ ...S.mono, fontSize:10, color:'#4a5468', marginTop:1 }}>Pusok · Lapu-Lapu City · Cebu</div>
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ ...S.syne, fontSize:20, fontWeight:800, color:'#00d4aa', letterSpacing:'-0.01em' }}>Currency Exchange Rates</div>
          <div style={{ ...S.mono, fontSize:10, color:'#4a5468', marginTop:3, letterSpacing:'0.08em' }}>{today.toUpperCase()}</div>
        </div>
        <div style={{ ...S.mono, fontSize:10, color:'#4a5468', textAlign:'right', lineHeight:1.8 }}>
          <div style={{ color:'#00d4aa', fontSize:11, fontWeight:700 }}>PUBLISHED RATES</div>
          <div>Rates are per 1 unit of foreign currency</div>
          <div>in Philippine Peso (PHP)</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, animation:'fadeUp 0.4s ease 0.1s both' }}>
        {[left, right].map((col, ci) => (
          <div key={ci} style={S.card}>
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 110px 110px', padding:'9px 20px', borderBottom:'1px solid rgba(0,212,170,0.18)', background:'rgba(0,212,170,0.06)', gap:14, alignItems:'center' }}>
              <span style={{ ...S.mono, fontSize:9, color:'#00d4aa', letterSpacing:'0.18em' }}>FLAG</span>
              <span style={{ ...S.mono, fontSize:9, color:'#00d4aa', letterSpacing:'0.18em' }}>CURRENCY</span>
              <span style={{ ...S.mono, fontSize:9, color:'#5b8cff', letterSpacing:'0.18em', textAlign:'right' }}>BUY</span>
              <span style={{ ...S.mono, fontSize:9, color:'#00d4aa', letterSpacing:'0.18em', textAlign:'right' }}>SELL</span>
            </div>
            {col.map((c, i) => (
              <div key={c.code} style={{ display:'grid', gridTemplateColumns:'auto 1fr 110px 110px', padding:'13px 20px', borderBottom: i < col.length - 1 ? '1px solid #1e2230' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.014)', gap:14, alignItems:'center' }}>
                <span style={{ fontSize:22, lineHeight:1, flexShrink:0 }}>{c.flag}</span>
                <div>
                  <span style={{ ...S.syne, fontSize:13, fontWeight:700, color:'#e2e6f0', letterSpacing:'0.01em' }}>{c.name.toUpperCase()}</span>
                  <span style={{ ...S.mono, fontSize:9, color:'#4a5468', marginLeft:8 }}>{c.code}</span>
                </div>
                <span style={{ ...S.mono, fontSize:15, fontWeight:600, color:'#5b8cff', textAlign:'right' }}>{fmt(c.todayBuyRate, c.decimalPlaces)}</span>
                <span style={{ ...S.mono, fontSize:15, fontWeight:700, color:'#00d4aa', textAlign:'right' }}>{fmt(c.todaySellRate, c.decimalPlaces)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ ...S.mono, fontSize:10, color:'#4a5468', textAlign:'center', paddingBottom:8, letterSpacing:'0.08em' }}>
        RATES ARE SUBJECT TO CHANGE WITHOUT PRIOR NOTICE · FOR INQUIRIES CONTACT THE COUNTER
      </div>
    </div>
  );
}

const BRANCHES = ['PUSOK', 'SM', 'AYALA', 'MAIN'];

function TrackerTab({ data }: { data: DashboardSummary }) {
  const { positions } = data;
  const [role, setRole]         = useState<'ADMIN'|'CASHIER'>('CASHIER');
  const [view, setView]         = useState<'balances'|'passbook'>('balances');
  const [entries, setEntries]   = useState<TrackerEntry[]>([]);
  const [passbook, setPb]       = useState<PassbookEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [branch, setBranch]     = useState('PUSOK');
  const [f, setF] = useState({ customer:'', currency:'USD', foreignAmt:'', cashPaid:'', checkNo:'', bank:'' });

  useEffect(() => {
    try {
      const e = localStorage.getItem('kedco-tracker'); if (e) setEntries(JSON.parse(e));
      const p = localStorage.getItem('kedco-passbook'); if (p) setPb(JSON.parse(p));
    } catch {}
  }, []);
  useEffect(() => { localStorage.setItem('kedco-tracker', JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem('kedco-passbook', JSON.stringify(passbook)); }, [passbook]);

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
    if (!isPaid) {
      const pb: PassbookEntry = { id:`PB-${Date.now()}`, date: new Date().toLocaleDateString('en-PH'), amount: checkAmt, description:`Pending check — ${f.customer} (${f.checkNo||'no ref'})`, refId: entry.id, branch };
      setPb(prev => [pb, ...prev]);
    }
    setF({ customer:'', currency:'USD', foreignAmt:'', cashPaid:'', checkNo:'', bank:'' });
    setShowForm(false);
  };

  const markDeposited = (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'FULLY PAID' as const, depositedDate: new Date().toLocaleDateString('en-PH') } : e));
    setPb(prev => prev.map(p => p.refId === id ? { ...p, description: p.description.replace('Pending check', 'Deposited check') } : p));
  };

  const pending      = entries.filter(e => e.status === 'PENDING');
  const paid         = entries.filter(e => e.status === 'FULLY PAID');
  const pendingTotal = pending.reduce((s, e) => s + e.checkAmt, 0);
  const branchPb     = passbook.filter(p => p.branch === branch);
  const pbBalance    = branchPb.reduce((s, p) => s + p.amount, 0);

  const inp = (label: string, key: keyof typeof f, opts?: { type?: string; placeholder?: string }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', letterSpacing:'0.12em' }}>{label}</label>
      <input
        type={opts?.type||'text'}
        placeholder={opts?.placeholder||''}
        value={f[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))}
        style={{ background:'#161922', border:'1px solid #1e2230', borderRadius:6, padding:'8px 10px', color:'#e2e6f0', fontFamily:"'DM Mono',monospace", fontSize:12, outline:'none', width:'100%' }}
      />
    </div>
  );

  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6 }}>
          {(['balances','passbook'] as const).map(v => (
            <button key={v} onClick={()=>setView(v)} style={{ padding:'7px 18px', borderRadius:6, border:`1px solid ${view===v?'#00d4aa':'#1e2230'}`, background:view===v?'rgba(0,212,170,0.1)':'transparent', color:view===v?'#00d4aa':'#4a5468', fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.1em', cursor:'pointer', textTransform:'uppercase' }}>{v}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'#161922', border:'1px solid #1e2230', borderRadius:8, padding:'4px' }}>
            {(['CASHIER','ADMIN'] as const).map(r => (
              <button key={r} onClick={()=>setRole(r)} style={{ padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.08em', background: role===r ? (r==='ADMIN'?'rgba(245,166,35,0.2)':'rgba(91,140,255,0.2)') : 'transparent', color: role===r ? (r==='ADMIN'?'#f5a623':'#5b8cff') : '#4a5468', transition:'all 0.15s' }}>
                {r==='ADMIN' ? '🔐 ADMIN' : '🖥️ CASHIER'}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4a5468', letterSpacing:'0.1em' }}>BRANCH</span>
            {BRANCHES.map(b => (
              <button key={b} onClick={()=>setBranch(b)} style={{ padding:'5px 12px', borderRadius:5, border:`1px solid ${branch===b?'#a78bfa':'#1e2230'}`, background:branch===b?'rgba(167,139,250,0.1)':'transparent', color:branch===b?'#a78bfa':'#4a5468', fontFamily:"'DM Mono',monospace", fontSize:10, cursor:'pointer' }}>{b}</button>
            ))}
          </div>
        </div>
      </div>

      {view === 'balances' && (
        <>
          {role === 'ADMIN' && <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
            {[
              { label:'PENDING CHECKS', val:php(pendingTotal), sub:`${pending.length} customer${pending.length!==1?'s':''} with balance`, color:'#ff5c5c' },
              { label:'FULLY PAID TODAY', val:String(paid.length), sub:'All cleared', color:'#00d4aa' },
              { label:'TOTAL ENTRIES', val:String(entries.length), sub:'Cumulative', color:'#5b8cff' },
            ].map(c => (
              <div key={c.label} style={{ ...S.card, padding:'18px 22px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${c.color},transparent)` }}/>
                <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', letterSpacing:'0.15em', marginBottom:6 }}>{c.label}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:c.color, lineHeight:1, marginBottom:4 }}>{c.val}</div>
                <div style={{ fontSize:11, color:'#4a5468' }}>{c.sub}</div>
              </div>
            ))}
          </div>}

          <div>
            <button onClick={()=>setShowForm(s=>!s)} style={{ padding:'8px 20px', borderRadius:7, border:'1px solid rgba(0,212,170,0.35)', background:'rgba(0,212,170,0.08)', color:'#00d4aa', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:'0.02em' }}>
              {showForm ? '✕ Cancel' : '+ Add Entry'}
            </button>
            {showForm && (
              <div style={{ ...S.card, padding:'22px 24px', marginTop:12, border:'1px solid rgba(0,212,170,0.2)', animation:'fadeUp 0.25s ease both' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, marginBottom:16, color:'#00d4aa' }}>New Customer Entry</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 140px 140px 140px', gap:12, marginBottom:12 }}>
                  {inp('CUSTOMER NAME', 'customer', { placeholder:'e.g. Nancy' })}
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <label style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', letterSpacing:'0.12em' }}>CURRENCY</label>
                    <select value={f.currency} onChange={e=>setF(p=>({...p,currency:e.target.value}))} style={{ background:'#161922', border:'1px solid #1e2230', borderRadius:6, padding:'8px 10px', color:'#e2e6f0', fontFamily:"'DM Mono',monospace", fontSize:12, outline:'none' }}>
                      {positions.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                  </div>
                  {inp('FOREIGN AMT', 'foreignAmt', { type:'number', placeholder:'e.g. 100000' })}
                  {inp('CASH PAID (PHP)', 'cashPaid', { type:'number', placeholder:'e.g. 100000' })}
                  <div style={{ display:'flex', flexDirection:'column', gap:4, justifyContent:'flex-end' }}>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', letterSpacing:'0.12em' }}>COMPUTED</div>
                    <div style={{ background:'#0f1117', border:'1px solid #1e2230', borderRadius:6, padding:'8px 10px' }}>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4a5468' }}>Rate: {rate.toFixed(4)}</div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#f5a623' }}>Total: {php(totalPhp)}</div>
                      <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color: checkAmt > 0 ? '#ff5c5c' : '#00d4aa' }}>Check: {php(checkAmt)}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                  {inp('CHECK NO.', 'checkNo', { placeholder:'e.g. 001234' })}
                  {inp('BANK', 'bank', { placeholder:'e.g. BDO, BPI...' })}
                </div>
                <button onClick={addEntry} style={{ padding:'9px 24px', borderRadius:7, border:'none', background:'linear-gradient(135deg,#00d4aa,#00a884)', color:'#000', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:800, cursor:'pointer', letterSpacing:'0.02em' }}>Save Entry</button>
              </div>
            )}
          </div>

          {pending.length > 0 && (
            <div style={S.card}>
              <div style={{ padding:'14px 22px', borderBottom:'1px solid #1e2230', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'#ff5c5c' }}>⏳ Pending Checks</div>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#ff5c5c' }}>{php(pendingTotal)} outstanding</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 110px 110px 110px 120px 120px', padding:'9px 22px', borderBottom:'1px solid #1e2230', fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', letterSpacing:'0.1em', gap:10 }}>
                <span>CUSTOMER</span><span>CCY</span><span>FOREIGN AMT</span><span>PHP TOTAL</span><span>CASH PAID</span><span>CHECK AMT</span><span>CHECK / BANK</span><span></span>
              </div>
              {pending.map((e, i) => (
                <div key={e.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 110px 110px 110px 120px 120px', padding:'13px 22px', borderBottom:i<pending.length-1?'1px solid #1e2230':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:10 }}>
                  <div><div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700 }}>{e.customer}</div><div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468' }}>{e.date}</div></div>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:'#f5a623', fontWeight:600 }}>{e.currency}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>{e.foreignAmt.toLocaleString()}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>{php(e.totalPhp)}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#00d4aa' }}>{php(e.cashPaid)}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:'#ff5c5c', fontWeight:600 }}>{php(e.checkAmt)}</span>
                  <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10 }}><div style={{ color:'#e2e6f0' }}>{e.checkNo||'—'}</div><div style={{ color:'#4a5468' }}>{e.bank||'—'}</div></div>
                  <button onClick={()=>markDeposited(e.id)} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid rgba(0,212,170,0.4)', background:'rgba(0,212,170,0.08)', color:'#00d4aa', fontFamily:"'DM Mono',monospace", fontSize:10, cursor:'pointer', letterSpacing:'0.05em' }}>MARK DEPOSITED</button>
                </div>
              ))}
            </div>
          )}

          {paid.length > 0 && (
            <div style={S.card}>
              <div style={{ padding:'14px 22px', borderBottom:'1px solid #1e2230' }}><div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'#00d4aa' }}>✅ Fully Paid</div></div>
              {paid.map((e, i) => (
                <div key={e.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 110px 110px 140px', padding:'11px 22px', borderBottom:i<paid.length-1?'1px solid #1e2230':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:10 }}>
                  <div><div style={{ fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, color:'#4a5468' }}>{e.customer}</div><div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468' }}>{e.date}{e.depositedDate ? ` · deposited ${e.depositedDate}` : ''}</div></div>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:'#4a5468' }}>{e.currency}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468' }}>{e.foreignAmt.toLocaleString()}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468' }}>{php(e.totalPhp)}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468' }}>{php(e.cashPaid)}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#00d4aa', padding:'3px 10px', background:'rgba(0,212,170,0.08)', borderRadius:20, border:'1px solid rgba(0,212,170,0.2)', textAlign:'center' }}>FULLY PAID</span>
                </div>
              ))}
            </div>
          )}

          {entries.length === 0 && (
            <div style={{ ...S.card, padding:'48px', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, marginBottom:6 }}>No entries yet</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468' }}>Click + Add Entry to log a customer transaction with check payment</div>
            </div>
          )}
        </>
      )}

      {view === 'passbook' && (
        <>
          {role === 'ADMIN' && <div style={{ ...S.card, padding:'24px 28px', border:'1px solid rgba(91,140,255,0.28)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-40, right:-40, width:130, height:130, borderRadius:'50%', background:'radial-gradient(circle,rgba(91,140,255,0.1) 0%,transparent 70%)', pointerEvents:'none' }}/>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4a5468', letterSpacing:'0.2em', marginBottom:8 }}>PASSBOOK BALANCE · {branch} BRANCH</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:42, fontWeight:800, color:'#5b8cff', lineHeight:1, marginBottom:8 }}>{php(pbBalance)}</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468' }}>{branchPb.length} deposit{branchPb.length!==1?'s':''} recorded</div>
          </div>}
          <div style={S.card}>
            <div style={{ padding:'14px 22px', borderBottom:'1px solid #1e2230', display:'flex', justifyContent:'space-between', alignItems:'center' }}><div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700 }}>Deposit Log</div></div>
            {branchPb.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468' }}>No deposits recorded.</div>
            ) : (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 140px', padding:'9px 22px', borderBottom:'1px solid #1e2230', fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', letterSpacing:'0.1em', gap:12 }}>
                  <span>DATE</span><span>DESCRIPTION</span><span style={{ textAlign:'right' }}>AMOUNT</span>
                </div>
                {branchPb.map((p, i) => (
                  <div key={p.id} style={{ display:'grid', gridTemplateColumns:'100px 1fr 140px', padding:'13px 22px', borderBottom:i<branchPb.length-1?'1px solid #1e2230':'none', background:i%2===0?'transparent':'rgba(255,255,255,0.012)', alignItems:'center', gap:12 }}>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4a5468' }}>{p.date}</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>{p.description}</span>
                    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:'#5b8cff', fontWeight:600, textAlign:'right' }}>{php(p.amount)}</span>
                  </div>
                ))}
                <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 140px', padding:'13px 22px', borderTop:'2px solid rgba(91,140,255,0.35)', background:'rgba(91,140,255,0.06)', gap:12, alignItems:'center' }}>
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4a5468', gridColumn:'span 2' }}>TOTAL BALANCE</span>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:800, color:'#5b8cff', textAlign:'right' }}>{php(pbBalance)}</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardShell({ data }: { data: DashboardSummary }) {
  const [active, setActive] = useState('Dashboard');
  return (
    <div style={{ minHeight:'100vh', position:'relative', zIndex:1 }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ticker { from { transform:translateX(0); } to { transform:translateX(-50%); } }
      `}</style>
      <Nav active={active} set={setActive}/>
      <Ticker positions={data.positions}/>
      {active==='Dashboard'    && <DashboardTab    data={data}/>}
      {active==='Positions'    && <PositionsTab    data={data}/>}
      {active==='Transactions' && <TransactionsTab data={data}/>}
      {active==='Rider'        && <RiderTab        data={data}/>}
      {active==='Rate Board'   && <RateBoardTab    data={data}/>}
      {active==='Tracker'      && <TrackerTab      data={data}/>}
    </div>
  );
}
