import { redirect } from 'next/navigation';
import { getCurrencies, getTokenRole } from '@/lib/api';
import RateSetterForm from '@/app/_components/RateSetterForm';

export default async function AdminRatesPage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin') redirect('/');

  const currencies = await getCurrencies();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div style={{ minHeight:'100vh', background:'#080a10', color:'#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:'56px', borderBottom:'1px solid #1e2230', background:'rgba(15,17,23,0.96)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#e2e6f0', fontFamily:"'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', marginTop:-2 }}>Admin Panel</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/dashboard" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid #1e2230', background:'transparent', color:'#4a5468', fontFamily:"'DM Mono',monospace", fontSize:11, textDecoration:'none', cursor:'pointer' }}>← Dashboard</a>
          <a href="/admin" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid rgba(0,212,170,0.3)', background:'rgba(0,212,170,0.08)', color:'#00d4aa', fontFamily:"'DM Mono',monospace", fontSize:11, textDecoration:'none' }}>Admin Home</a>
        </div>
      </nav>

      <div style={{ padding:'28px 32px', display:'flex', flexDirection:'column', gap:20 }}>
        {/* Header */}
        <div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4a5468', letterSpacing:'0.2em', marginBottom:6 }}>RATE MANAGEMENT</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:'#e2e6f0', letterSpacing:'-0.02em' }}>Set Today&apos;s Rates</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468', marginTop:4 }}>{today.toUpperCase()}</div>
        </div>

        <RateSetterForm currencies={currencies} />
      </div>
    </div>
  );
}
