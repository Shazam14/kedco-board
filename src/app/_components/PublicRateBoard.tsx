'use client';
import { useState, useEffect } from 'react';

interface Rate {
  currency_code: string;
  name: string;
  flag: string;
  decimal_places: number;
  buy_rate: number;
  sell_rate: number;
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

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
  card: { background:'#0f1117', border:'1px solid #1e2230', borderRadius:'14px', overflow:'hidden' },
  mono: { fontFamily:"'DM Mono',monospace" },
  syne: { fontFamily:"'Syne',sans-serif" },
};

export default function PublicRateBoard({ rates, isLoggedIn }: { rates: Rate[]; isLoggedIn: boolean }) {
  const now = useLiveClock();
  const w   = useWindowWidth();
  const isMobile = w < 768;
  const today = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });

  const half  = Math.ceil(rates.length / 2);
  const left  = rates.slice(0, half);
  const right = rates.slice(half);

  return (
    <div style={{ minHeight:'100vh', background:'#080a10', color:'#e2e6f0' }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:'56px', borderBottom:'1px solid #1e2230', background:'rgba(15,17,23,0.96)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
          <div>
            <div style={{ ...S.syne, fontSize:13, fontWeight:700, color:'#e2e6f0' }}>Kedco FX</div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', marginTop:-2 }}>Pusok · Lapu-Lapu City</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#00d4aa', boxShadow:'0 0 8px #00d4aa88' }} />
          <span style={{ ...S.mono, fontSize:11, color:'#00d4aa' }}>LIVE</span>
          {!isMobile && <span style={{ ...S.mono, fontSize:11, color:'#4a5468' }}>{timeStr}</span>}
          {isLoggedIn
            ? <a href="/dashboard" style={{ marginLeft:8, padding:'4px 14px', borderRadius:6, border:'1px solid rgba(0,212,170,0.25)', background:'rgba(0,212,170,0.06)', color:'#00d4aa', fontFamily:"'DM Mono',monospace", fontSize:10, textDecoration:'none', letterSpacing:'0.05em' }}>GO TO DASHBOARD</a>
            : <a href="/login"    style={{ marginLeft:8, padding:'4px 14px', borderRadius:6, border:'1px solid rgba(0,212,170,0.25)', background:'rgba(0,212,170,0.06)', color:'#00d4aa', fontFamily:"'DM Mono',monospace", fontSize:10, textDecoration:'none', letterSpacing:'0.05em' }}>STAFF LOGIN</a>
          }
        </div>
      </nav>

      <div style={{ padding: isMobile ? '16px' : '28px 32px', display:'flex', flexDirection:'column', gap:22 }}>
        {/* Header card */}
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
          <div style={{ ...S.mono, fontSize:10, color:'#4a5468', textAlign: isMobile ? 'left' : 'right', lineHeight:1.8 }}>
            <div style={{ color:'#00d4aa', fontSize:11, fontWeight:700 }}>PUBLISHED RATES</div>
            <div>Rates are per 1 unit of foreign currency</div>
            <div>in Philippine Peso (PHP)</div>
          </div>
        </div>

        {rates.length === 0 ? (
          <div style={{ ...S.card, padding:'48px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
            <div style={{ ...S.syne, fontSize:15, fontWeight:700, marginBottom:6 }}>Rates not yet set for today</div>
            <div style={{ ...S.mono, fontSize:11, color:'#4a5468' }}>Please check back later or contact the counter.</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:14, animation:'fadeUp 0.4s ease 0.1s both' }}>
            {[left, right].map((col, ci) => (
              <div key={ci} style={S.card}>
                <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 110px 110px', padding:'9px 20px', borderBottom:'1px solid rgba(0,212,170,0.18)', background:'rgba(0,212,170,0.06)', gap:14, alignItems:'center' }}>
                  <span style={{ ...S.mono, fontSize:9, color:'#00d4aa', letterSpacing:'0.18em' }}>FLAG</span>
                  <span style={{ ...S.mono, fontSize:9, color:'#00d4aa', letterSpacing:'0.18em' }}>CURRENCY</span>
                  <span style={{ ...S.mono, fontSize:9, color:'#5b8cff', letterSpacing:'0.18em', textAlign:'right' }}>BUY</span>
                  <span style={{ ...S.mono, fontSize:9, color:'#00d4aa', letterSpacing:'0.18em', textAlign:'right' }}>SELL</span>
                </div>
                {col.map((r, i) => (
                  <div key={r.currency_code} style={{ display:'grid', gridTemplateColumns:'auto 1fr 110px 110px', padding:'13px 20px', borderBottom: i < col.length - 1 ? '1px solid #1e2230' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.014)', gap:14, alignItems:'center' }}>
                    <span style={{ fontSize:22, lineHeight:1, flexShrink:0 }}>{r.flag}</span>
                    <div>
                      <span style={{ ...S.syne, fontSize:13, fontWeight:700, color:'#e2e6f0', letterSpacing:'0.01em' }}>{r.name.toUpperCase()}</span>
                      <span style={{ ...S.mono, fontSize:9, color:'#4a5468', marginLeft:8 }}>{r.currency_code}</span>
                    </div>
                    <span style={{ ...S.mono, fontSize:15, fontWeight:600, color:'#5b8cff', textAlign:'right' }}>{r.buy_rate.toFixed(r.decimal_places)}</span>
                    <span style={{ ...S.mono, fontSize:15, fontWeight:700, color:'#00d4aa', textAlign:'right' }}>{r.sell_rate.toFixed(r.decimal_places)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div style={{ ...S.mono, fontSize:10, color:'#4a5468', textAlign:'center', paddingBottom:8, letterSpacing:'0.08em' }}>
          RATES ARE SUBJECT TO CHANGE WITHOUT PRIOR NOTICE · FOR INQUIRIES CONTACT THE COUNTER
        </div>
      </div>
    </div>
  );
}
