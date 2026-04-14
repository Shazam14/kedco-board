import { redirect } from 'next/navigation';
import { getTokenRole, getPositions } from '@/lib/api';
import PositionSetterForm from '@/app/_components/PositionSetterForm';

export default async function AdminPositionsPage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin') redirect('/');

  const positions = await getPositions();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'#e2e6f0' }}>
      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:'56px', borderBottom:'1px solid var(--border)', background:'var(--nav-bg)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#e2e6f0', fontFamily:"'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'var(--muted)', marginTop:-2 }}>Admin Panel</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/dashboard" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontFamily:"'DM Mono',monospace", fontSize:11, textDecoration:'none' }}>← Dashboard</a>
          <a href="/admin" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid rgba(91,140,255,0.3)', background:'rgba(91,140,255,0.08)', color:'#5b8cff', fontFamily:"'DM Mono',monospace", fontSize:11, textDecoration:'none' }}>Admin Home</a>
        </div>
      </nav>

      <div style={{ padding:'28px 32px', display:'flex', flexDirection:'column', gap:20 }}>
        {/* Header */}
        <div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--muted)', letterSpacing:'0.2em', marginBottom:6 }}>ADMIN · POSITIONS</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:'#e2e6f0', letterSpacing:'-0.02em' }}>Opening Positions</div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'var(--muted)', marginTop:4 }}>{today.toUpperCase()}</div>
        </div>

        {/* Info card */}
        <div style={{ background:'var(--surface)', border:'1px solid rgba(91,140,255,0.25)', borderRadius:14, padding:'20px 24px' }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'#5b8cff', marginBottom:12 }}>When to use this</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              'First day of operations — enter your starting stock for each currency',
              'After EOD runs, carry-forward is automatic — no need to come back here',
              'You can also use this to manually correct a position if needed',
              'Carry-In Rate = what you paid for the stock (yesterday\'s closing sell rate)',
            ].map((item, i) => (
              <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ color:'#5b8cff', fontFamily:"'DM Mono',monospace", fontSize:11, marginTop:1 }}>{i + 1}.</span>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#e2e6f0', lineHeight:1.6 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <PositionSetterForm positions={positions} />
      </div>
    </div>
  );
}
