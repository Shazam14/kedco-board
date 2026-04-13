'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import type { DashboardSummary, CurrencyPosition } from '@/lib/types';

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
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Nav({ role }: { role: string }) {
  const router = useRouter();
  const now    = useLiveClock();
  const w      = useWindowWidth();
  const isMobile = w < 768;
  const dateStr = now ? now.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
  const timeStr = now ? now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }) : '';

  async function handleLogout() {
    await fetch('/api/auth/logout', { method:'POST' });
    router.push('/login');
  }

  return (
    <nav style={{ ...S.nav, flexWrap: isMobile ? 'wrap' : 'nowrap', height: isMobile ? 'auto' : '56px', padding: isMobile ? '10px 16px' : '0 32px', gap: isMobile ? 8 : 0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#e2e6f0', letterSpacing:'-0.01em' }}>Kedco FX</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', marginTop:-2 }}>Pusok · Lapu-Lapu City</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:'#00d4aa', boxShadow:'0 0 8px #00d4aa88' }} />
        <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#00d4aa' }}>LIVE</span>
        {!isMobile && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468' }}>{dateStr} · {timeStr}</span>}
        <a href="/guide" style={{ marginLeft: isMobile ? 0 : 8, padding:'4px 12px', borderRadius:6, border:'1px solid #1e2230', background:'transparent', color:'#4a5468', fontFamily:"'DM Mono',monospace", fontSize:10, cursor:'pointer', letterSpacing:'0.05em', textDecoration:'none' }}>GUIDE</a>
        {['admin','supervisor'].includes(role) && <a href="/admin" style={{ padding:'4px 12px', borderRadius:6, border:'1px solid rgba(0,212,170,0.25)', background:'rgba(0,212,170,0.06)', color:'#00d4aa', fontFamily:"'DM Mono',monospace", fontSize:10, cursor:'pointer', letterSpacing:'0.05em', textDecoration:'none' }}>ADMIN</a>}
        <button onClick={handleLogout} style={{ padding:'4px 12px', borderRadius:6, border:'1px solid #1e2230', background:'transparent', color:'#4a5468', fontFamily:"'DM Mono',monospace", fontSize:10, cursor:'pointer', letterSpacing:'0.05em' }}>LOGOUT</button>
      </div>
    </nav>
  );
}

function RateBoard({ data }: { data: DashboardSummary }) {
  const w = useWindowWidth();
  const isMobile = w < 768;
  const { positions } = data;
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }));
  }, []);
  const half  = Math.ceil(positions.length / 2);
  const left  = positions.slice(0, half);
  const right = positions.slice(half);
  return (
    <div style={{ ...S.page, padding: isMobile ? '16px' : '28px 32px' }}>
      <div style={{ ...S.card, padding:'24px 32px', display:'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent:'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 16 : 0, border:'1px solid rgba(0,212,170,0.22)', animation:'fadeUp 0.3s ease both' }}>
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
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:14, animation:'fadeUp 0.4s ease 0.1s both' }}>
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

export default function DashboardShell({ data, role }: { data: DashboardSummary; role: string }) {
  useIdleTimeout(20);
  return (
    <div style={{ minHeight:'100vh', position:'relative', zIndex:1 }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ticker { from { transform:translateX(0); } to { transform:translateX(-50%); } }
      `}</style>
      <Nav role={role}/>
      <Ticker positions={data.positions}/>
      <RateBoard data={data}/>
    </div>
  );
}
