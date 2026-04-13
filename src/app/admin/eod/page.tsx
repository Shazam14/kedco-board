'use client';
import { useState } from 'react';

const S: Record<string, React.CSSProperties> = {
  card: { background:'#0f1117', border:'1px solid #1e2230', borderRadius:14, overflow:'hidden' },
  mono: { fontFamily:"'DM Mono',monospace" },
  syne: { fontFamily:"'Syne',sans-serif" },
};

const php = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');

interface EodResult {
  closed_date:       string;
  currencies_rolled: number;
  tomorrow_ready:    string;
  total_than:        number;
  total_bought:      number;
  total_sold:        number;
  closing_capital:   number;
  closed_by:         string;
  message:           string;
}

export default function EodPage() {
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<EodResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday:'long', year:'numeric', month:'long', day:'numeric',
  });

  async function handleClose() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res  = await fetch('/api/admin/eod', { method:'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'EOD failed');
      } else {
        setResult(data);
      }
    } finally {
      setLoading(false);
      setConfirmed(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#080a10', color:'#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:'56px', borderBottom:'1px solid #1e2230', background:'rgba(15,17,23,0.96)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#e2e6f0', ...S.syne }}>Kedco FX</div>
            <div style={{ ...S.mono, fontSize:9, color:'#4a5468', marginTop:-2 }}>Admin Panel</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/admin" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid #1e2230', color:'#4a5468', ...S.mono, fontSize:11, textDecoration:'none' }}>← Admin</a>
          <a href="/dashboard" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid #1e2230', color:'#4a5468', ...S.mono, fontSize:11, textDecoration:'none' }}>Dashboard</a>
        </div>
      </nav>

      <div style={{ padding:'28px 32px', maxWidth:680, margin:'0 auto', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Header */}
        <div>
          <div style={{ ...S.mono, fontSize:10, color:'#4a5468', letterSpacing:'0.2em', marginBottom:6 }}>ADMIN · EOD</div>
          <div style={{ ...S.syne, fontSize:26, fontWeight:800, letterSpacing:'-0.02em' }}>End of Day Close</div>
          <div style={{ ...S.mono, fontSize:11, color:'#4a5468', marginTop:4 }}>{today.toUpperCase()}</div>
        </div>

        {/* What this does */}
        <div style={{ ...S.card, padding:'20px 24px', border:'1px solid rgba(245,166,35,0.25)' }}>
          <div style={{ ...S.syne, fontSize:13, fontWeight:700, color:'#f5a623', marginBottom:12 }}>What this does</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              'Calculates remaining stock per currency (carry-in + bought − sold)',
              "Sets tomorrow's opening positions using today's closing sell rate as cost basis",
              'Saves today\'s P&L summary (THAN, capital, bought, sold)',
              'Ken\'s averaging rule resets — tomorrow starts fresh',
            ].map((item, i) => (
              <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ color:'#f5a623', ...S.mono, fontSize:11, marginTop:1 }}>{i + 1}.</span>
                <span style={{ ...S.mono, fontSize:11, color:'#e2e6f0', lineHeight:1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confirmation + button */}
        {!result && (
          <div style={{ ...S.card, padding:'24px', border:'1px solid rgba(245,166,35,0.2)' }}>
            <label style={{ display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer', marginBottom:20 }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                style={{ marginTop:2, accentColor:'#f5a623', width:16, height:16, cursor:'pointer' }}
              />
              <span style={{ ...S.mono, fontSize:12, color:'#e2e6f0', lineHeight:1.6 }}>
                I confirm all transactions for today are recorded and rates are set. I want to close the day.
              </span>
            </label>

            {error && (
              <div style={{ ...S.mono, fontSize:11, color:'#ff5c5c', background:'rgba(255,92,92,0.08)', border:'1px solid rgba(255,92,92,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
                ✗ {error}
              </div>
            )}

            <button
              onClick={handleClose}
              disabled={!confirmed || loading}
              style={{ width:'100%', padding:'14px', borderRadius:8, border:'none', background: (!confirmed || loading) ? '#1e2230' : 'linear-gradient(135deg,#f5a623,#e09000)', color: (!confirmed || loading) ? '#4a5468' : '#000', ...S.syne, fontSize:14, fontWeight:800, cursor: (!confirmed || loading) ? 'not-allowed' : 'pointer', letterSpacing:'0.02em', transition:'all 0.2s' }}
            >
              {loading ? 'CLOSING DAY...' : '🔒 CLOSE TODAY\'S DAY'}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ ...S.card, padding:'28px', border:'1px solid rgba(0,212,170,0.3)', animation:'fadeUp 0.3s ease both' }}>
            <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'rgba(0,212,170,0.12)', border:'1px solid rgba(0,212,170,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✓</div>
              <div>
                <div style={{ ...S.syne, fontSize:15, fontWeight:800, color:'#00d4aa' }}>Day Closed Successfully</div>
                <div style={{ ...S.mono, fontSize:10, color:'#4a5468', marginTop:2 }}>{result.message}</div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {[
                { label:'CLOSING CAPITAL',    val: php(result.closing_capital), color:'#00d4aa' },
                { label:'TOTAL THAN TODAY',   val: php(result.total_than),      color:'#00d4aa' },
                { label:'TOTAL BOUGHT',       val: php(result.total_bought),    color:'#5b8cff' },
                { label:'TOTAL SOLD',         val: php(result.total_sold),      color:'#f5a623' },
              ].map(row => (
                <div key={row.label} style={{ background:'#161922', border:'1px solid #1e2230', borderRadius:10, padding:'14px 18px' }}>
                  <div style={{ ...S.mono, fontSize:9, color:'#4a5468', letterSpacing:'0.12em', marginBottom:4 }}>{row.label}</div>
                  <div style={{ ...S.syne, fontSize:20, fontWeight:800, color:row.color }}>{row.val}</div>
                </div>
              ))}
            </div>

            <div style={{ ...S.mono, fontSize:11, color:'#4a5468', borderTop:'1px solid #1e2230', paddingTop:16, display:'flex', justifyContent:'space-between' }}>
              <span>{result.currencies_rolled} currencies rolled forward</span>
              <span>Tomorrow ready: {result.tomorrow_ready}</span>
              <span>Closed by: {result.closed_by}</span>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <a href="/dashboard" style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid rgba(0,212,170,0.3)', background:'rgba(0,212,170,0.08)', color:'#00d4aa', ...S.syne, fontSize:12, fontWeight:700, textDecoration:'none', textAlign:'center' }}>
                View Dashboard
              </a>
              <a href="/admin" style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid #1e2230', color:'#4a5468', ...S.syne, fontSize:12, fontWeight:700, textDecoration:'none', textAlign:'center' }}>
                Admin Home
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
