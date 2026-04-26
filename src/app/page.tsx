import { getTokenRole } from '@/lib/api';

const BRANCHES = [
  {
    name: 'Main Branch',
    code: 'MAIN',
    address: 'ML Quezon National Highway, Pusok, Lapu-Lapu City, Cebu',
    note: 'Head Office',
  },
  {
    name: 'CTS',
    code: 'CTS',
    address: 'A-218 City Timesquare, Mantawe Ave., Mandaue City, Cebu',
    note: '',
  },
  {
    name: 'Bai Hotel',
    code: 'BAI',
    address: 'Bai Hotel, Piano Ave. cor. C.D. Seno St., Mantuyong, Mandaue City',
    note: '',
  },
  {
    name: 'SM',
    code: 'SM',
    address: 'Gspot Food Park, Kaohsiung St., Mabolo, Cebu City',
    note: '',
  },
  {
    name: 'Gold',
    code: 'GOLD',
    address: 'Sitio Seabreeze, Pusok, Lapu-Lapu City',
    note: '',
  },
  {
    name: 'Jmall',
    code: 'JMALL',
    address: 'V. Albino St., Bakilid, Mandaue City, Cebu',
    note: '',
  },
  {
    name: 'ESY 2',
    code: 'ESY2',
    address: 'ML Quezon National Highway, Pusok, Lapu-Lapu City, Cebu',
    note: '',
  },
  {
    name: 'Monekat Datag',
    code: 'DATAG',
    address: 'Maribago, City of Lapu-Lapu, Cebu',
    note: '',
  },
  {
    name: 'Monekat Mobo',
    code: 'MOBO',
    address: 'Basdiot, Moalboal, Cebu',
    note: '',
  },
];

export default async function Home() {
  const role      = await getTokenRole();
  const isLoggedIn = !!role;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-deep)', color: 'var(--text)' }}>

      {/* ── NAV ── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '60px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--nav-bg)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: 'var(--text-on-teal)',
            fontFamily: 'var(--font-display)',
          }}>K</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
              Kedco <span style={{ color: 'var(--teal-300)' }}>FX</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', marginTop: -1 }}>Foreign Exchange Services</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isLoggedIn && (
            <a href="/dashboard" style={{
              padding: '5px 16px', borderRadius: 6,
              border: '1px solid rgba(61,199,173,0.25)',
              background: 'rgba(61,199,173,0.06)',
              color: 'var(--teal-300)',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              textDecoration: 'none', letterSpacing: '0.05em',
            }}>DASHBOARD</a>
          )}
          <a href="/login" style={{
            padding: '5px 16px', borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'transparent', color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 10,
            textDecoration: 'none', letterSpacing: '0.05em',
          }}>STAFF LOGIN</a>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '52px 24px 72px' }}>

        {/* ── HERO ── */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 22,
            background: 'linear-gradient(135deg,var(--teal-300),var(--teal-600))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, fontWeight: 700, color: 'var(--text-on-teal)',
            fontFamily: 'var(--font-display)', margin: '0 auto 28px',
            boxShadow: '0 20px 40px -10px rgba(61,199,173,0.35)',
          }}>K</div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,5vw,40px)',
            fontWeight: 500, color: 'var(--text-strong)',
            letterSpacing: '-0.02em', margin: '0 0 14px',
          }}>Kedco Foreign Exchange</h1>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            color: 'var(--text-muted)', margin: '0 auto',
            maxWidth: 440, lineHeight: 1.9,
          }}>
            Your trusted money changer in Cebu. Fast, reliable, and secure currency exchange — across 9 locations.
          </p>
        </div>

        {/* ── BRANCHES ── */}
        <div style={{ marginBottom: 52 }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--teal-300)', letterSpacing: '0.18em',
            marginBottom: 24, textAlign: 'center',
          }}>OUR 9 BRANCHES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {BRANCHES.map(b => (
              <div key={b.code} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 16, padding: '20px 24px',
                boxShadow: 'var(--shadow-card)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(61,199,173,0.1)',
                    border: '1px solid rgba(61,199,173,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15,
                  }}>📍</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{b.name}</div>
                    {b.note && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--teal-300)', letterSpacing: '0.1em', marginTop: 1 }}>{b.note.toUpperCase()}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)', marginTop: 2, flexShrink: 0, letterSpacing: '0.06em' }}>ADDRESS</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>{b.address}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SERVICES ── */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 16, padding: '32px 28px', marginBottom: 52,
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal-300)', letterSpacing: '0.18em', marginBottom: 24 }}>SERVICES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
            {[
              { icon: '💱', title: 'Currency Exchange', desc: 'Buy and sell major foreign currencies at competitive rates.' },
              { icon: '✈️', title: 'Travel Money',      desc: 'Get the currency you need before your trip, quickly and hassle-free.' },
              { icon: '🏢', title: 'Corporate FX',      desc: 'Serving businesses, travel agencies, and corporate clients.' },
            ].map(s => (
              <div key={s.title}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{s.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)', marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-faint)', textAlign: 'center',
          lineHeight: 2.2, letterSpacing: '0.06em',
        }}>
          <div>KEDCO FOREIGN EXCHANGE SERVICES · LAPU-LAPU CITY, CEBU</div>
          <div>BSP AUTHORIZED MONEY CHANGER</div>
        </div>

      </div>
    </div>
  );
}
