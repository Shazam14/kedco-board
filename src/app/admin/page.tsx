import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';

const tools = [
  {
    href:  '/counter',
    icon:  '🖥️',
    title: 'Counter',
    desc:  'Enter buy and sell transactions for walk-in customers.',
    color: '#00d4aa',
  },
  {
    href:  '/admin/rates',
    icon:  '📊',
    title: 'Set Today\'s Rates',
    desc:  'Enter buy and sell rates for all 29 currencies.',
    color: '#00d4aa',
  },
  {
    href:  '/admin/positions',
    icon:  '📦',
    title: 'Opening Positions',
    desc:  'Set carry-in stock quantities from previous day.',
    color: '#5b8cff',
  },
  {
    href:  '/admin/users',
    icon:  '👤',
    title: 'Manage Users',
    desc:  'Add or deactivate cashier accounts.',
    color: '#a78bfa',
    soon:  true,
  },
  {
    href:  '/admin/eod',
    icon:  '🔒',
    title: 'End of Day',
    desc:  'Close the day, lock rates, generate summary report.',
    color: '#f5a623',
  },
  {
    href:  '/admin/report',
    icon:  '📋',
    title: 'Daily Report',
    desc:  'Full day breakdown by currency and cashier. Replaces the 6 manual books.',
    color: '#a78bfa',
  },
];

export default async function AdminPage() {
  const role = await getTokenRole();
  if (role !== 'admin') redirect('/');

  return (
    <div style={{ minHeight:'100vh', background:'#080a10', color:'#e2e6f0' }}>
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:'56px', borderBottom:'1px solid #1e2230', background:'rgba(15,17,23,0.96)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#e2e6f0', fontFamily:"'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', marginTop:-2 }}>Admin Panel</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/guide" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid #1e2230', background:'transparent', color:'#4a5468', fontFamily:"'DM Mono',monospace", fontSize:11, textDecoration:'none' }}>Guide</a>
          <a href="/" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid #1e2230', background:'transparent', color:'#4a5468', fontFamily:"'DM Mono',monospace", fontSize:11, textDecoration:'none' }}>← Dashboard</a>
        </div>
      </nav>

      <div style={{ padding:'28px 32px' }}>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'#4a5468', letterSpacing:'0.2em', marginBottom:6 }}>ADMIN PANEL</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, marginBottom:28, letterSpacing:'-0.02em' }}>What do you need to do?</div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
          {tools.map(tool => (
            <a
              key={tool.href}
              href={tool.soon ? '#' : tool.href}
              style={{ background:'#0f1117', border:`1px solid ${tool.soon ? '#1e2230' : tool.color + '33'}`, borderRadius:14, padding:'24px', textDecoration:'none', display:'block', opacity: tool.soon ? 0.5 : 1, cursor: tool.soon ? 'default' : 'pointer', position:'relative', overflow:'hidden' }}
            >
              {!tool.soon && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${tool.color},transparent)` }} />}
              <div style={{ fontSize:28, marginBottom:12 }}>{tool.icon}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, color: tool.soon ? '#4a5468' : '#e2e6f0', marginBottom:6 }}>
                {tool.title}
                {tool.soon && <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'#4a5468', marginLeft:8, letterSpacing:'0.1em' }}>COMING SOON</span>}
              </div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'#4a5468', lineHeight:1.6 }}>{tool.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
