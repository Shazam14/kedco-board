export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SafeCard from './SafeCard';
import CashMapCard from './CashMapCard';

const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(t: string) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

const tools: { href: string; icon: string; title: string; desc: string; color: string }[] = [
  {
    href:  '/admin/report',
    icon:  '📋',
    title: 'Daily Report',
    desc:  'Full day breakdown by currency, cashier, and stock.',
    color: '#a78bfa',
  },
  {
    href:  '/supervisor/payables',
    icon:  '⏳',
    title: 'Pending Payments',
    desc:  'Confirm payment slices once funds clear.',
    color: '#d4a64a',
  },
  {
    href:  '/supervisor/transactions',
    icon:  '📒',
    title: 'Transactions',
    desc:  'All buy/sell entries — search, filter, inspect.',
    color: '#00d4aa',
  },
  {
    href:  '/counter',
    icon:  '🖥️',
    title: 'Counter',
    desc:  'Enter buy and sell transactions for walk-in customers.',
    color: '#00d4aa',
  },
  {
    href:  '/admin/positions',
    icon:  '📦',
    title: 'Opening Positions',
    desc:  'Set carry-in stock quantities and rates for the day.',
    color: '#5b8cff',
  },
  {
    href:  '/admin/rates',
    icon:  '💱',
    title: 'Today’s Rates',
    desc:  'Set buy/sell rates, or copy from yesterday’s carry-in.',
    color: '#00d4aa',
  },
  {
    href:  '/supervisor/dispatch',
    icon:  '🏍️',
    title: 'Rider Dispatch',
    desc:  'Dispatch riders, track top-ups, confirm returns.',
    color: '#f5a623',
  },
  {
    href:  '/supervisor/floats',
    icon:  '💵',
    title: 'Cashier Floats',
    desc:  'Set opening floats — cashiers see them when they open shift.',
    color: '#5b8cff',
  },
  {
    href:  '/admin/eod',
    icon:  '🔒',
    title: 'End of Day',
    desc:  'Close today after the 3pm cut-off — rolls stock to tomorrow.',
    color: '#f5a623',
  },
];

export default async function SupervisorPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');
  const payload = decodeToken(token);
  if (!payload || !['admin', 'supervisor'].includes(payload.role)) redirect('/login');

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'#e2e6f0' }}>
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', height:'56px', borderBottom:'1px solid var(--border)', background:'var(--nav-bg)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#00d4aa,#00a884)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#000' }}>K</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#e2e6f0', fontFamily:"'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:'var(--muted)', marginTop:-2 }}>Treasurer</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href="/dashboard" style={{ padding:'6px 16px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontFamily:"'DM Mono',monospace", fontSize:11, textDecoration:'none' }}>← Dashboard</a>
        </div>
      </nav>

      <div style={{ padding:'28px 32px' }}>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:'var(--muted)', letterSpacing:'0.2em', marginBottom:6 }}>TREASURER</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, marginBottom:28, letterSpacing:'-0.02em' }}>What do you need to do?</div>

        <CashMapCard />

        <SafeCard />

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
          {tools.map(tool => (
            <a
              key={tool.href}
              href={tool.href}
              style={{ background:'var(--surface)', border:`1px solid ${tool.color}33`, borderRadius:14, padding:'24px', textDecoration:'none', display:'block', position:'relative', overflow:'hidden' }}
            >
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${tool.color},transparent)` }} />
              <div style={{ fontSize:28, marginBottom:12 }}>{tool.icon}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, color:'#e2e6f0', marginBottom:6 }}>{tool.title}</div>
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:'var(--muted)', lineHeight:1.6 }}>{tool.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
