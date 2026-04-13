import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';

export default async function GuidePage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');

  return (
    <div style={{ minHeight: '100vh', background: '#080a10', color: '#e2e6f0' }}>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid #1e2230', background: 'rgba(15,17,23,0.96)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e6f0', fontFamily: "'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#4a5468', marginTop: -2 }}>Staff Guide</div>
          </div>
        </div>
        <a href="/dashboard" style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #1e2230', background: 'transparent', color: '#4a5468', fontFamily: "'DM Mono',monospace", fontSize: 11, textDecoration: 'none' }}>← Back to Dashboard</a>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* HEADER */}
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#4a5468', letterSpacing: '0.2em', marginBottom: 8 }}>STAFF GUIDE</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>How to use Kedco FX</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#4a5468' }}>Quick reference for admin, cashiers, and riders.</div>
        </div>

        {/* ADMIN SECTION */}
        <Section icon="👑" title="Admin (Ken)" color="#00d4aa">
          <Block title="Day 1 — First time setup only">
            <ol>
              <li>Go to <Route href="/admin/rates">/admin/rates</Route> → <strong>Set Today&apos;s Rates</strong> — enter buy and sell rates for all currencies</li>
              <li style={{ marginTop: 8 }}>Go to <Route href="/admin/positions">/admin/positions</Route> → <strong>Opening Positions</strong> — enter your actual stock quantities and the rates you acquired them at</li>
              <li style={{ marginTop: 8 }}>Done — cashiers can now start transacting</li>
            </ol>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.15)', borderRadius: 8, fontSize: 11, color: '#f5a623' }}>
              After Day 1, carry-in stock is automatic — EOD carries your closing stock forward to the next day.
            </div>
          </Block>
          <Block title="Every day (after Day 1)">
            <p>Go to <Route href="/admin/rates">/admin/rates</Route> → <strong>Set Today&apos;s Rates</strong> — that&apos;s all. Opening stock is already carried in from yesterday.</p>
          </Block>
          <Block title="During the day">
            <ul>
              <li><Route href="/dashboard">/dashboard</Route> — live capital position, THAN, stock summary</li>
              <li><strong>Positions</strong> tab — current stock quantities per currency</li>
              <li><strong>Transactions</strong> tab — everything from counter + rider in real time</li>
              <li><Route href="/">/</Route> — public rate board (share this link with customers to see today&apos;s rates)</li>
            </ul>
          </Block>
          <Block title="End of day">
            <ol>
              <li>Go to <Route href="/admin/eod">/admin/eod</Route> → <strong>End of Day</strong> — closes the day, calculates THAN, carries stock to tomorrow</li>
              <li style={{ marginTop: 8 }}>Go to <Route href="/admin/report">/admin/report</Route> → <strong>Daily Report</strong> — full breakdown by currency and cashier, print or save as PDF</li>
            </ol>
          </Block>
        </Section>

        {/* CASHIER SECTION */}
        <Section icon="🖥️" title="Cashier — Counter" color="#5b8cff">
          <Block title="Every transaction">
            <p style={{ marginBottom: 12, color: '#4a5468' }}>You land here automatically after login at <Route href="/counter">/counter</Route>.</p>
            <ol>
              <li>Choose <strong>BUY</strong> (customer selling to Kedco) or <strong>SELL</strong> (customer buying from Kedco)</li>
              <li>Pick the currency</li>
              <li>Enter the foreign amount — rate fills in automatically, PHP total shows live</li>
              <li>Enter customer name (optional but good habit)</li>
              <li>Hit <strong>Submit</strong> → print receipt for the customer</li>
            </ol>
          </Block>
          <Note>If the screen shows a &quot;rates not set&quot; warning — let admin know to set today&apos;s rates first.</Note>
        </Section>

        {/* RIDER SECTION */}
        <Section icon="🏍️" title="Rider — Field Screen" color="#a78bfa">
          <Block title="How it works">
            <ol>
              <li><strong>Admin dispatches rider</strong> — goes to Dashboard → Rider tab → selects rider, enters PHP cash given → marks as IN FIELD</li>
              <li style={{ marginTop: 8 }}><strong>Rider logs in on phone</strong> — lands on <Route href="/rider">/rider</Route> automatically. BUY/SELL with large mobile-friendly buttons. All transactions sync to the dashboard in real time.</li>
              <li style={{ marginTop: 8 }}><strong>Rider returns</strong> — Admin marks rider as RETURNED. All rider transactions appear in the daily report alongside counter transactions.</li>
            </ol>
          </Block>
          <Block title="Payment modes">
            <p style={{ color: '#4a5468' }}>Each transaction can be tagged: <strong>Cash</strong>, <strong>GCash</strong>, <strong>Cheque</strong>, <strong>Bank Transfer</strong>, or <strong>Other</strong>. The daily report breaks these down automatically.</p>
          </Block>
          <div style={{ marginTop: 12, display: 'inline-block', fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 6, padding: '4px 12px', letterSpacing: '0.1em', margin: '0 24px 20px' }}>COMING SOON</div>
        </Section>

        {/* STAFF ACCOUNTS */}
        <Section icon="👤" title="Staff Accounts" color="#f5a623">
          <Block title="">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2230' }}>
                  {['ROLE', 'USERNAME', 'DEFAULT PASSWORD'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, color: '#4a5468', letterSpacing: '0.12em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Admin',       'admin',                        'ChangeMe@2026!'],
                  ['Supervisors', 'supervisor1, supervisor2',     'Kedco@2026!'],
                  ['Cashiers',    'cashier1 – cashier7',          'Kedco@2026!'],
                  ['Riders',      'rider01 – rider10',            'Kedco@2026!'],
                ].map(([role, user, pw], i) => (
                  <tr key={role} style={{ borderBottom: '1px solid #1e2230', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                    <td style={{ padding: '10px 12px', color: '#e2e6f0', fontWeight: 600 }}>{role}</td>
                    <td style={{ padding: '10px 12px', color: '#00d4aa' }}>{user}</td>
                    <td style={{ padding: '10px 12px', color: '#f5a623' }}>{pw}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Note>First thing: go to <Route href="/admin/users">/admin/users</Route> to rename accounts to real names and reset passwords.</Note>
          </Block>
        </Section>

        {/* QUICK ROUTES */}
        <Section icon="📋" title="Quick Routes" color="#4a5468">
          <Block title="">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2230' }}>
                  {['ROUTE', 'WHAT IT DOES'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, color: '#4a5468', letterSpacing: '0.12em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['/',                 'Public rate board — share with customers'],
                  ['/dashboard',        'Live capital dashboard (admin/supervisor)'],
                  ['/counter',          'Cashier transaction screen'],
                  ['/rider',            'Rider field screen (mobile)'],
                  ['/admin',            'Admin panel'],
                  ['/admin/rates',      'Set today\'s rates'],
                  ['/admin/positions',  'Opening positions (Day 1 setup only)'],
                  ['/admin/eod',        'End of day'],
                  ['/admin/report',     'Daily report — print to PDF'],
                  ['/admin/users',      'Manage staff accounts'],
                  ['/guide',            'This page'],
                ].map(([route, desc], i) => (
                  <tr key={route} style={{ borderBottom: '1px solid #1e2230', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                    <td style={{ padding: '10px 12px' }}><Route href={route}>{route}</Route></td>
                    <td style={{ padding: '10px 12px', color: '#4a5468' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
        </Section>

        {/* FAQ */}
        <Section icon="❓" title="Common Questions" color="#4a5468">
          {[
            ['First day setup — where do I start?', 'Go to /admin/rates first to set today\'s rates, then /admin/positions to enter your opening stock. After that you\'re ready to transact. From Day 2 onwards, only rates need to be set — stock carries over automatically from EOD.'],
            ['"Rates not set" on the counter', 'Admin needs to set today\'s rates at /admin/rates first.'],
            ['What is THAN?', 'Kedco\'s margin per sell transaction — the difference between your average cost for the currency and what you sold it for. Your profit per transaction.'],
            ['Dashboard shows no data', 'Today\'s rates haven\'t been set yet. Admin sets them at /admin/rates.'],
            ['"Session ended due to inactivity"', 'The system logs out after 20 minutes idle — just a security measure. Log back in.'],
          ].map(([q, a]) => (
            <div key={q} style={{ borderBottom: '1px solid #1e2230', paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{q}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#4a5468', lineHeight: 1.7 }}>{a}</div>
            </div>
          ))}
        </Section>

        {/* FOOTER */}
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#4a5468', textAlign: 'center', paddingTop: 16, borderTop: '1px solid #1e2230' }}>
          Kedco FX · Pusok, Lapu-Lapu City · For internal use only
        </div>

      </div>
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function Section({ icon, title, color, children }: { icon: string; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0f1117', border: `1px solid ${color}22`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e2230', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, color: '#e2e6f0' }}>{title}</span>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {children}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      {title && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#4a5468', letterSpacing: '0.15em', marginBottom: 10 }}>{title.toUpperCase()}</div>}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#e2e6f0', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#4a5468', lineHeight: 1.7 }}>
      {children}
    </div>
  );
}

function Route({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={{ color: '#00d4aa', textDecoration: 'none', fontFamily: "'DM Mono',monospace" }}>{children}</a>
  );
}
