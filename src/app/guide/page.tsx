import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';

export default async function GuidePage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');

  const branchLocation = process.env.BRANCH_LOCATION ?? 'Lapu-Lapu City';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#e2e6f0' }}>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: '56px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00d4aa,#00a884)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#000' }}>K</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e6f0', fontFamily: "'Syne',sans-serif" }}>Kedco FX</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: 'var(--muted)', marginTop: -2 }}>Staff Guide</div>
          </div>
        </div>
        <a href="/dashboard" style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontFamily: "'DM Mono',monospace", fontSize: 11, textDecoration: 'none' }}>← Back to Dashboard</a>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* HEADER */}
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.2em', marginBottom: 8 }}>STAFF GUIDE</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>How to use Kedco FX</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--muted)' }}>Quick reference for admin, cashiers, and riders.</div>
        </div>

        {/* DEMO VIDEOS */}
        <Section icon="🎬" title="Demo Videos" color="#00d4aa">
          <Block title="Watch before your first shift">
            <p style={{ marginBottom: 16, color: 'var(--muted)' }}>
              Short screen recordings of the real system — click play, watch, then do it yourself.
            </p>
          </Block>
          {[
            { file: 'admin-daily', label: 'Admin — Daily Workflow', desc: 'Set rates · Counter · Positions · Dispatch rider · Manage users · EOD · Report', color: '#00d4aa' },
            { file: 'admin',       label: 'Admin — Full Walkthrough', desc: 'Every admin page in one continuous tour', color: '#5b8cff' },
            { file: 'cashier',     label: 'Cashier — Counter Workflow', desc: 'Open shift · BUY · SELL · Close shift', color: '#5b8cff' },
            { file: 'rider',       label: 'Rider — Field Screen', desc: 'Login · BUY · SELL on mobile', color: '#a78bfa' },
          ].map(v => (
            <div key={v.file} style={{ background: 'var(--surface2)', border: `1px solid ${v.color}22`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: '#e2e6f0' }}>{v.label}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{v.desc}</div>
                </div>
              </div>
              <video
                controls
                style={{ width: '100%', display: 'block', maxHeight: 400, background: '#000' }}
                src={`/videos/${v.file}.webm`}
              />
            </div>
          ))}
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            Videos not loading? Run: <code style={{ color: '#00d4aa' }}>npm run copy-videos</code> after re-recording the demo.
          </div>
        </Section>

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
              <li><Route href="/admin/rates">/admin/rates</Route> — view or update today&apos;s rates anytime</li>
            </ul>
          </Block>
          <Block title="During the day — monitoring cashier shifts">
            <p style={{ marginBottom: 10, color: 'var(--muted)' }}>Go to <Route href="/admin/shifts">/admin/shifts</Route> to see every cashier&apos;s shift for today:</p>
            <ul>
              <li>Who opened a shift and at what time</li>
              <li>How many transactions each cashier did</li>
              <li>Total sold, total bought, total THAN per cashier</li>
              <li>Shift status — OPEN (still working) or CLOSED (ended shift)</li>
              <li>On close: expected cash, actual cash declared, and variance</li>
            </ul>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
              A <strong style={{ color: '#ff5c5c' }}>negative variance</strong> on close means the cashier is short — investigate before end of day.
              A <strong style={{ color: '#00d4aa' }}>zero variance</strong> means the drawer counted perfectly.
            </div>
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
          <Block title="Starting your shift">
            <p style={{ marginBottom: 12, color: 'var(--muted)' }}>You land here automatically after login at <Route href="/counter">/counter</Route>.</p>
            <ol>
              <li><strong>Count your drawer</strong> — tally the PHP cash you are starting with</li>
              <li style={{ marginTop: 8 }}>The screen will show an <strong>Open Shift</strong> overlay — enter your opening cash amount and tap <strong>OPEN SHIFT</strong></li>
              <li style={{ marginTop: 8 }}>The counter unlocks — you can now process transactions</li>
            </ol>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(91,140,255,0.06)', border: '1px solid rgba(91,140,255,0.15)', borderRadius: 8, fontSize: 11, color: '#5b8cff' }}>
              You must open a shift before the first transaction of the day. The system blocks the counter until this is done.
            </div>
          </Block>
          <Block title="Every transaction">
            <ol>
              <li>Choose <strong>BUY</strong> (customer selling to Kedco) or <strong>SELL</strong> (customer buying from Kedco)</li>
              <li>Pick the currency</li>
              <li>Enter the foreign amount — rate fills in automatically, PHP total shows live</li>
              <li>Enter customer name (optional but good habit)</li>
              <li>Select <strong>payment mode</strong> — Cash, GCash, Maya, ShopeePay, Bank Transfer, Cheque, or Other (default is Cash)</li>
              <li>Hit <strong>Submit</strong> → print receipt for the customer</li>
            </ol>
          </Block>
          <Block title="Ending your shift">
            <ol>
              <li>Tap the <strong>END SHIFT</strong> button in the top-right of the counter screen</li>
              <li style={{ marginTop: 8 }}>The system shows your shift summary — transaction count, total sold, total bought, opening cash</li>
              <li style={{ marginTop: 8 }}><strong>Count your drawer</strong> — enter the actual PHP cash you have now</li>
              <li style={{ marginTop: 8 }}>Tap <strong>CLOSE SHIFT</strong> — the system calculates the expected amount and shows you the variance</li>
            </ol>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(91,140,255,0.06)', border: '1px solid rgba(91,140,255,0.15)', borderRadius: 8, fontSize: 11, color: '#5b8cff', lineHeight: 1.7 }}>
              <strong>Expected cash formula:</strong> Opening cash + all SELL receipts − all BUY payouts.<br />
              A zero variance means your drawer matches perfectly. A negative variance means you&apos;re short — flag it to admin.
            </div>
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
            <p style={{ color: 'var(--muted)' }}>Each transaction can be tagged: <strong>Cash</strong>, <strong>GCash</strong>, <strong>Maya</strong>, <strong>ShopeePay</strong>, <strong>Bank Transfer</strong>, <strong>Cheque</strong>, or <strong>Other</strong>. The daily report breaks these down automatically.</p>
          </Block>
          <Note>Rider must be dispatched by admin first — admin sets the starting PHP cash. Without dispatch, the balance card won&apos;t show.</Note>
        </Section>

        {/* WHAT THIS REPLACES */}
        <Section icon="📂" title="What This Replaces (CSV → System)" color="#00d4aa">
          <Block title="">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['OLD CSV FILE', 'REPLACED BY'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['BUY x MAIN',    'Daily Report → MAIN currencies, BUY rows (USD, JPY, KRW)'],
                  ['BUY x 2ND',     'Daily Report → 2ND currencies, BUY rows (AUD, EUR, GBP, SGD + 11 more)'],
                  ['BUY x OTHERS',  'Daily Report → OTHERS currencies, BUY rows (BHD, IDR, INR + 6 more)'],
                  ['SELL x MAIN',   'Daily Report → MAIN currencies, SELL rows + THAN'],
                  ['SELL x OTHERS', 'Daily Report → OTHERS + 2ND currencies, SELL rows + THAN'],
                  ['CASHIER',       'Daily Report → By Cashier section (BUY total, SELL total, THAN per cashier)'],
                  ['STOCKS LEFT',   'Dashboard → Positions tab (live closing stock)'],
                ].map(([old, rep], i) => (
                  <tr key={old} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                    <td style={{ padding: '10px 12px', color: '#f5a623', fontFamily: "'DM Mono',monospace" }}>{old}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{rep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Note>
              The Daily Report at <Route href="/admin/report">/admin/report</Route> is printable as PDF —
              it is the single document that covers all 7 of the above files in one page.
              Print it at end of day instead of downloading CSVs.
            </Note>
          </Block>
          <Block title="Currency categories">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'MAIN', color: '#00d4aa', currencies: 'USD · JPY · KRW' },
                { label: '2ND', color: '#5b8cff', currencies: 'AED · AUD · CAD · CHF · CNY · EUR · GBP · HKD · MYR · NTD · NZD · QAR · SAR · SGD · THB' },
                { label: 'OTHERS', color: '#f5a623', currencies: 'BHD · BND · DKK · IDR · INR · MOP · NOK · OMR · TYR' },
              ].map(({ label, color, currencies }) => (
                <div key={label} style={{ background: `${color}08`, border: `1px solid ${color}22`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color, letterSpacing: '0.15em', marginBottom: 6, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>{currencies}</div>
                </div>
              ))}
            </div>
          </Block>
          <Block title="Note on EXPENSES / COM">
            <div style={{ padding: '10px 14px', background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.15)', borderRadius: 8, fontSize: 11, color: '#f5a623', lineHeight: 1.7 }}>
              The CASHIER CSV has an EXPENSES/COM row (e.g. ₱500 commission deductions). This is not yet tracked
              in the system — enter it manually in the notes field of your daily report for now.
              We can add a dedicated expense entry screen in a future update.
            </div>
          </Block>
        </Section>

        {/* DAY 1 TEST CHECKLIST */}
        <Section icon="✅" title="Day 1 Test Checklist" color="#a78bfa">
          <Block title="Before you start">
            <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Run through this with real numbers from a recent day to verify the system matches your manual books.</p>
          </Block>
          <Block title="Step 1 — Set rates">
            <ol>
              <li>Log in as <strong>admin</strong> → go to <Route href="/admin/rates">/admin/rates</Route></li>
              <li style={{ marginTop: 6 }}>Enter today&apos;s BUY and SELL rates for each currency</li>
              <li style={{ marginTop: 6 }}>Check: rates appear on the Dashboard → Capital tab</li>
            </ol>
          </Block>
          <Block title="Step 2 — Enter opening stock">
            <ol>
              <li>Go to <Route href="/admin/positions">/admin/positions</Route></li>
              <li style={{ marginTop: 6 }}>Enter the quantity and acquisition rate for each currency you have on hand</li>
              <li style={{ marginTop: 6 }}>Check: Dashboard → Positions tab shows your stock quantities and PHP value</li>
              <li style={{ marginTop: 6 }}>Check: Dashboard → Capital tab shows total PHP capital (should match your manual tally)</li>
            </ol>
          </Block>
          <Block title="Step 3 — Open a cashier shift">
            <ol>
              <li>Log in as <strong>cashier1</strong> → auto-lands on <Route href="/counter">/counter</Route></li>
              <li style={{ marginTop: 6 }}>The <strong>Open Shift</strong> overlay appears — enter ₱10,000 as the opening cash (test amount)</li>
              <li style={{ marginTop: 6 }}>Tap <strong>OPEN SHIFT</strong> — counter unlocks</li>
              <li style={{ marginTop: 6 }}>Log in as admin → go to <Route href="/admin/shifts">/admin/shifts</Route> — verify cashier1&apos;s shift shows as OPEN</li>
            </ol>
          </Block>
          <Block title="Step 4 — Test a BUY transaction (counter)">
            <ol>
              <li>Still logged in as cashier1 on the counter</li>
              <li style={{ marginTop: 6 }}>Select BUY, pick a currency (e.g. USD), enter amount and rate</li>
              <li style={{ marginTop: 6 }}>Submit → receipt prints (or opens print dialog)</li>
              <li style={{ marginTop: 6 }}>Check: Dashboard → Transactions shows this transaction</li>
              <li style={{ marginTop: 6 }}>Check: Dashboard → Positions — USD stock went up by the amount you bought</li>
            </ol>
          </Block>
          <Block title="Step 5 — Test a SELL transaction (counter)">
            <ol>
              <li>On the same counter, select SELL, pick same currency</li>
              <li style={{ marginTop: 6 }}>Submit → check that THAN (gain) appears on the receipt and on Dashboard</li>
              <li style={{ marginTop: 6 }}>Check: THAN = (sell rate − average cost) × units sold — compare to your manual calculation</li>
            </ol>
          </Block>
          <Block title="Step 6 — Close the cashier shift">
            <ol>
              <li>On the counter, tap <strong>END SHIFT</strong> (top right, amber button)</li>
              <li style={{ marginTop: 6 }}>The modal shows: transactions done, total sold, total bought, opening cash</li>
              <li style={{ marginTop: 6 }}>Count your test drawer → enter the actual cash → tap <strong>CLOSE SHIFT</strong></li>
              <li style={{ marginTop: 6 }}>Check: <Route href="/admin/shifts">/admin/shifts</Route> shows the shift as CLOSED with expected cash, actual cash, and variance</li>
              <li style={{ marginTop: 6 }}>Verify: expected cash = ₱10,000 opening + SELL receipts − BUY payouts</li>
            </ol>
          </Block>
          <Block title="Step 7 — Test a rider transaction">
            <ol>
              <li>Log in as <strong>admin</strong> → Dashboard → Riders tab → dispatch a rider with starting PHP cash</li>
              <li style={{ marginTop: 6 }}>Log in as <strong>rider01</strong> on a phone → PHP balance card shows starting cash</li>
              <li style={{ marginTop: 6 }}>Record a BUY → balance card updates (remaining PHP decreases)</li>
              <li style={{ marginTop: 6 }}>Check: admin can see rider&apos;s transactions in the Riders tab</li>
            </ol>
          </Block>
          <Block title="Step 8 — Run End of Day">
            <ol>
              <li>Log in as admin → <Route href="/admin/eod">/admin/eod</Route> → run EOD</li>
              <li style={{ marginTop: 6 }}>Go to <Route href="/admin/report">/admin/report</Route> → print to PDF</li>
              <li style={{ marginTop: 6 }}>Compare totals against your manual CSVs for that day:</li>
            </ol>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Total BUY PHP',       'Grand Total BUY in CASHIER CSV (BUY MAIN + BUY 2ND + BUY OTHERS)'],
                ['Total SELL PHP',      'Grand Total SELL in CASHIER CSV'],
                ['Total THAN',          'Grand Total THAN in CASHIER CSV'],
                ['MAIN currencies',     'BUY x MAIN + SELL x MAIN rows (USD, JPY, KRW)'],
                ['2ND currencies',      'BUY x 2ND + SELL x OTHERS rows (AUD, EUR, GBP…)'],
                ['OTHERS currencies',   'BUY x OTHERS + SELL x OTHERS rows (BHD, IDR, INR…)'],
                ['Closing stock',       'STOCKS LEFT CSV — qty per currency at end of day'],
                ['By Cashier',          'CASHIER CSV — per-cashier BUY / SELL / THAN totals'],
              ].map(([sys, csv]) => (
                <div key={sys} style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: '#a78bfa', marginBottom: 2 }}>System: {sys}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>vs CSV: {csv}</div>
                </div>
              ))}
            </div>
            <Note>If numbers match — you&apos;re good to go live. If they don&apos;t match, flag it and we&apos;ll investigate before going live.</Note>
          </Block>
        </Section>

        {/* STAFF ACCOUNTS */}
        <Section icon="👤" title="Staff Accounts" color="#f5a623">
          <Block title="">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ROLE', 'USERNAME', 'DEFAULT PASSWORD'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', fontWeight: 600 }}>{h}</th>
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
                  <tr key={role} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
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
        <Section icon="📋" title="Quick Routes" color="var(--muted)">
          <Block title="">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ROUTE', 'WHAT IT DOES'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['/',                 'Kedco landing page — branches and services (public)'],
                  ['/login',            'Staff login page'],
                  ['/dashboard',        'Live capital dashboard (admin/supervisor)'],
                  ['/counter',          'Cashier transaction screen'],
                  ['/rider',            'Rider field screen (mobile)'],
                  ['/admin',            'Admin panel'],
                  ['/admin/rates',      'Set today\'s rates'],
                  ['/admin/positions',  'Opening positions (Day 1 setup only)'],
                  ['/admin/eod',        'End of day'],
                  ['/admin/report',     'Daily report — print to PDF'],
                  ['/admin/shifts',     'Teller shift log — all cashier shifts today, variance on close'],
                  ['/admin/users',      'Manage staff accounts'],
                  ['/guide',            'This page'],
                ].map(([route, desc], i) => (
                  <tr key={route} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)' }}>
                    <td style={{ padding: '10px 12px' }}><Route href={route}>{route}</Route></td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
        </Section>

        {/* FAQ */}
        <Section icon="❓" title="Common Questions" color="var(--muted)">
          {[
            ['First day setup — where do I start?', 'Go to /admin/rates first to set today\'s rates, then /admin/positions to enter your opening stock. After that you\'re ready to transact. From Day 2 onwards, only rates need to be set — stock carries over automatically from EOD.'],
            ['"Rates not set" on the counter', 'Admin needs to set today\'s rates at /admin/rates first.'],
            ['The counter is blocked with "Open Shift"', 'Count your drawer and enter the opening PHP cash. You must open a shift before the counter unlocks. This is by design — it ensures every cashier\'s cash is tracked from the start.'],
            ['What is the expected closing cash?', 'Opening cash + total PHP received from SELLs − total PHP paid out for BUYs. If your count matches this number, variance is zero. A mismatch means short or over — flag it to admin.'],
            ['What is THAN?', 'Kedco\'s margin per sell transaction — the difference between your average cost for the currency and what you sold it for. Your profit per transaction.'],
            ['Dashboard shows no data', 'Today\'s rates haven\'t been set yet. Admin sets them at /admin/rates.'],
            ['"Session ended due to inactivity"', 'The system logs out after 20 minutes idle — just a security measure. Log back in.'],
          ].map(([q, a]) => (
            <div key={q} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{q}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>{a}</div>
            </div>
          ))}
        </Section>

        {/* FOOTER */}
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--muted)', textAlign: 'center', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          Kedco FX · {branchLocation} · For internal use only
        </div>

      </div>
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function Section({ icon, title, color, children }: { icon: string; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${color}22`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
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
      {title && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em', marginBottom: 10 }}>{title.toUpperCase()}</div>}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#e2e6f0', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 8, fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
      {children}
    </div>
  );
}

function Route({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={{ color: '#00d4aa', textDecoration: 'none', fontFamily: "'DM Mono',monospace" }}>{children}</a>
  );
}
