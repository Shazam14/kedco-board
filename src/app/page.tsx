import { getTokenRole } from '@/lib/api';

const S: Record<string, React.CSSProperties> = {
  mono: { fontFamily: "'DM Mono',monospace" },
  syne: { fontFamily: "'Syne',sans-serif" },
};

const BRANCHES = [
  { name: 'Branch 1', address: 'Lapu-Lapu City, Cebu', hours: 'Open 24/7', note: '' },
  { name: 'Branch 2', address: 'Lapu-Lapu City, Cebu', hours: 'Open 24/7', note: '' },
  { name: 'Branch 3', address: 'Lapu-Lapu City, Cebu', hours: 'Open 24/7', note: '' },
  { name: 'Branch 4', address: 'Lapu-Lapu City, Cebu', hours: 'Open 24/7', note: '' },
  { name: 'Branch 5', address: 'Lapu-Lapu City, Cebu', hours: 'Open 24/7', note: '' },
  { name: 'Branch 6', address: 'Lapu-Lapu City, Cebu', hours: 'Open 24/7', note: '' },
  { name: 'Branch 7', address: 'Lapu-Lapu City, Cebu', hours: 'Open 24/7', note: '' },
];

export default async function Home() {
  const role      = await getTokenRole();
  const isLoggedIn = !!role;

  return (
    <div style={{ minHeight: '100vh', background: '#080a10', color: '#e2e6f0' }}>

      {/* ── NAV ── */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid #1e2230', background: 'rgba(15,17,23,0.96)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000', ...S.syne }}>K</div>
          <div>
            <div style={{ ...S.syne, fontSize: 13, fontWeight: 700 }}>Kedco FX</div>
            <div style={{ ...S.mono, fontSize: 9, color: '#4a5468' }}>Foreign Exchange Services</div>
          </div>
        </div>
        {isLoggedIn
          ? <a href="/dashboard" style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid rgba(0,212,170,0.25)', background: 'rgba(0,212,170,0.06)', color: '#00d4aa', ...S.mono, fontSize: 10, textDecoration: 'none', letterSpacing: '0.05em' }}>DASHBOARD</a>
          : <a href="/login"    style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid rgba(0,212,170,0.25)', background: 'rgba(0,212,170,0.06)', color: '#00d4aa', ...S.mono, fontSize: 10, textDecoration: 'none', letterSpacing: '0.05em' }}>STAFF LOGIN</a>
        }
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px 64px' }}>

        {/* ── HERO ── */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 900, color: '#000', ...S.syne, margin: '0 auto 24px' }}>K</div>
          <h1 style={{ ...S.syne, fontSize: 36, fontWeight: 800, color: '#e2e6f0', letterSpacing: '-0.02em', margin: '0 0 12px' }}>Kedco Foreign Exchange</h1>
          <p style={{ ...S.mono, fontSize: 13, color: '#4a5468', margin: '0 auto', maxWidth: 420, lineHeight: 1.8 }}>
            Your trusted money changer in Lapu-Lapu City. Fast, reliable, and secure currency exchange services — open 24/7 across 7 locations.
          </p>
        </div>

        {/* ── BRANCHES ── */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ ...S.mono, fontSize: 10, color: '#00d4aa', letterSpacing: '0.18em', marginBottom: 20, textAlign: 'center' }}>OUR BRANCHES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {BRANCHES.map(b => (
              <div key={b.name} style={{ background: '#0f1117', border: '1px solid #1e2230', borderRadius: 16, padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📍</div>
                  <div>
                    <div style={{ ...S.syne, fontSize: 14, fontWeight: 700, color: '#e2e6f0' }}>{b.name}</div>
                    {b.note && <div style={{ ...S.mono, fontSize: 9, color: '#00d4aa', letterSpacing: '0.1em', marginTop: 1 }}>{b.note.toUpperCase()}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ ...S.mono, fontSize: 10, color: '#4a5468', marginTop: 1, flexShrink: 0 }}>ADDRESS</span>
                    <span style={{ ...S.mono, fontSize: 11, color: '#e2e6f0', lineHeight: 1.6 }}>{b.address}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ ...S.mono, fontSize: 10, color: '#4a5468', marginTop: 1, flexShrink: 0 }}>HOURS</span>
                    <span style={{ ...S.mono, fontSize: 11, color: '#e2e6f0' }}>{b.hours}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── WHAT WE DO ── */}
        <div style={{ background: '#0f1117', border: '1px solid #1e2230', borderRadius: 16, padding: '32px 28px', marginBottom: 48 }}>
          <div style={{ ...S.mono, fontSize: 10, color: '#00d4aa', letterSpacing: '0.18em', marginBottom: 20 }}>SERVICES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
            {[
              { icon: '💱', title: 'Currency Exchange', desc: 'Buy and sell major foreign currencies at competitive rates.' },
              { icon: '✈️', title: 'Travel Money',      desc: 'Get the currency you need before your trip, quickly and hassle-free.' },
              { icon: '🏢', title: 'Corporate FX',      desc: 'Serving businesses, travel agencies, and corporate clients.' },
            ].map(s => (
              <div key={s.title}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{s.icon}</div>
                <div style={{ ...S.syne, fontSize: 13, fontWeight: 700, color: '#e2e6f0', marginBottom: 6 }}>{s.title}</div>
                <div style={{ ...S.mono, fontSize: 11, color: '#4a5468', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER NOTE ── */}
        <div style={{ ...S.mono, fontSize: 10, color: '#4a5468', textAlign: 'center', lineHeight: 2, letterSpacing: '0.06em' }}>
          <div>KEDCO FOREIGN EXCHANGE SERVICES · LAPU-LAPU CITY, CEBU</div>
          <div>BSP AUTHORIZED MONEY CHANGER</div>
        </div>

      </div>
    </div>
  );
}
