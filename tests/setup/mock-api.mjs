/**
 * Lightweight mock FastAPI server for Playwright tests.
 * Runs on port 9999. Next.js dev server is started with API_URL=http://localhost:9999
 * so all server-side API calls hit this instead of the real backend.
 *
 * To run standalone: node tests/setup/mock-api.mjs
 */

import { createServer } from 'node:http';

// ── Fake JWT ────────────────────────────────────────────────────────────────
// Next.js only base64-decodes the payload — it does NOT verify the signature.
function makeJWT(sub, role) {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ sub, role, exp: 9_999_999_999 })).toString('base64');
  return `${header}.${payload}.test-sig-not-verified`;
}

// ── User map ─────────────────────────────────────────────────────────────────
const USERS = {
  admin:        { role: 'admin',      full_name: 'Admin User',     is_demo: false },
  supervisor1:  { role: 'supervisor', full_name: 'Supervisor One', is_demo: false },
  supervisor2:  { role: 'supervisor', full_name: 'Supervisor Two', is_demo: false },
  cashier1:     { role: 'cashier',    full_name: 'Cashier One',    is_demo: false },
  cashier2:     { role: 'cashier',    full_name: 'Cashier Two',    is_demo: false },
  rider01:      { role: 'rider',      full_name: 'Rider One',      is_demo: false },
  rider02:      { role: 'rider',      full_name: 'Rider Two',      is_demo: false },
  // ── Demo / recording accounts (excluded from reports, EOD, shift log) ──
  admintest:    { role: 'admin',      full_name: 'Admin (Demo)',   is_demo: true },
  cashiertest:  { role: 'cashier',    full_name: 'Cashier (Demo)', is_demo: true },
  ridertest:    { role: 'rider',      full_name: 'Rider (Demo)',   is_demo: true },
  devtest:      { role: 'admin',      full_name: 'Dev (Demo)',     is_demo: true },
};

// ── Fixture data ─────────────────────────────────────────────────────────────
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar',         flag: '🇺🇸', category: 'MAIN',   decimal_places: 2, today_buy_rate: 55.5,  today_sell_rate: 56.0,  rate_set: true },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺', category: '2ND',    decimal_places: 2, today_buy_rate: 35.0,  today_sell_rate: 35.5,  rate_set: true },
  { code: 'JPY', name: 'Japanese Yen',      flag: '🇯🇵', category: 'MAIN',   decimal_places: 0, today_buy_rate: 0.37,  today_sell_rate: 0.38,  rate_set: true },
  { code: 'GBP', name: 'British Pound',     flag: '🇬🇧', category: 'MAIN',   decimal_places: 2, today_buy_rate: 70.0,  today_sell_rate: 70.5,  rate_set: true },
  { code: 'SGD', name: 'Singapore Dollar',  flag: '🇸🇬', category: '2ND',    decimal_places: 2, today_buy_rate: 41.0,  today_sell_rate: 41.5,  rate_set: true },
];

const POSITIONS = CURRENCIES.map(c => ({
  code: c.code, name: c.name, flag: c.flag, category: c.category,
  decimal_places: c.decimal_places,
  total_qty: 1000,
  daily_avg_cost: c.today_buy_rate,
  today_buy_rate: c.today_buy_rate,
  today_sell_rate: c.today_sell_rate,
  stock_value_php: 1000 * c.today_buy_rate,
  today_gain_per_unit: c.today_sell_rate - c.today_buy_rate,
  unrealized_php: 1000 * (c.today_sell_rate - c.today_buy_rate),
}));

const DASHBOARD_SUMMARY = {
  date: new Date().toISOString().split('T')[0],
  opening_capital:   1_000_000,
  php_cash:            500_000,
  total_stock_value:   450_000,
  total_capital:       950_000,
  total_unrealized:      5_000,
  total_than_today:      1_500,
  total_bought_today:   50_000,
  total_sold_today:     45_000,
  positions: POSITIONS,
  recent_transactions: [],
};

const AUDIT_LOG = [
  {
    id: 'AUD-001', table: 'rates', record_id: 'USD-2026-04-14',
    action: 'UPDATE', changed_by: 'supervisor1',
    changed_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    old_value: { buy_rate: 55.00, sell_rate: 55.50 },
    new_value: { buy_rate: 55.50, sell_rate: 56.00 },
    note: null,
  },
  {
    id: 'AUD-002', table: 'transactions', record_id: 'TXN-2026-001',
    action: 'CREATE', changed_by: 'cashier1',
    changed_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    old_value: null,
    new_value: { type: 'BUY', currency: 'USD', foreign_amt: 500, rate: 55.50, php_amt: 27750 },
    note: null,
  },
  {
    id: 'AUD-003', table: 'transactions', record_id: 'TXN-2026-001',
    action: 'UPDATE', changed_by: 'admin',
    changed_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    old_value: { rate: 55.50, php_amt: 27750 },
    new_value: { rate: 55.00, php_amt: 27500 },
    note: 'Rate correction approved by admin',
  },
  {
    id: 'AUD-004', table: 'dispatches', record_id: 'DISP-001',
    action: 'CREATE', changed_by: 'admin',
    changed_at: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    old_value: null,
    new_value: { rider: 'rider01', cash_php: 50000, status: 'IN_FIELD' },
    note: null,
  },
  {
    id: 'AUD-005', table: 'users', record_id: 'cashier2',
    action: 'UPDATE', changed_by: 'admin',
    changed_at: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
    old_value: { full_name: 'Old Name', is_active: true },
    new_value: { full_name: 'Cashier Two', is_active: true },
    note: null,
  },
];

// ── Edit requests (mutable) ───────────────────────────────────────────────────
let EDIT_REQUESTS = [];

const BANKS = [
  { id: 1, name: 'BDO',       code: 'BDO', is_active: true, sort_order: 1 },
  { id: 2, name: 'BPI',       code: 'BPI', is_active: true, sort_order: 2 },
  { id: 3, name: 'Metrobank', code: 'MBK', is_active: true, sort_order: 3 },
];

// ── Special Credits ───────────────────────────────────────────────────────────
function makeInitialCredits() {
  return [
    {
      id: 'credit-001',
      customer_name: 'Sample Customer',
      currency_code: 'PHP',
      principal: 50000,
      interest: 2500,
      credit_type: 'UPFRONT',
      status: 'ACTIVE',
      disbursed_date: new Date().toISOString().split('T')[0],
      notes: 'Existing test credit',
      created_by: 'admin',
      installments: [
        { id: 'inst-001', installment_no: 1, due_date: '2026-05-15', amount: 50000, paid_at: null, received_by: null },
      ],
      draws: [],
    },
  ];
}
let CREDITS = makeInitialCredits();

const ALL_USERS = Object.entries(USERS).map(([username, u]) => ({
  username, full_name: u.full_name, role: u.role, is_active: true, is_demo: u.is_demo,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => resolve(body));
  });
}

// ── Date override state (mutable) ────────────────────────────────────────────
let mockTestDate = null;

// ── Shift state (mutable, resets on each mock-api process start) ─────────────
const today = new Date().toISOString().split('T')[0];

const TODAY_TRANSACTIONS = [
  {
    id: 'OR-TESTAAAA', date: today, time: '09:30 AM',
    type: 'BUY',  source: 'COUNTER', currency_code: 'USD',
    foreign_amt: 500, rate: 55.50, php_amt: 27750,
    daily_avg_cost: 55.50, than: 0,
    cashier: 'cashier1', customer: 'Juan dela Cruz', payment_mode: 'CASH',
  },
  {
    id: 'OR-TESTBBBB', date: today, time: '10:15 AM',
    type: 'SELL', source: 'COUNTER', currency_code: 'USD',
    foreign_amt: 200, rate: 56.00, php_amt: 11200,
    daily_avg_cost: 55.50, than: 100,
    cashier: 'cashier1', customer: 'Maria Santos', payment_mode: 'CASH',
  },
];

// cashier1 and admin start with open shifts so counter tests work for both roles
const SHIFTS = new Map([
  ['admin', {
    id: 'shift-admin-today',
    date: today,
    cashier: 'admin',
    cashier_name: 'Admin User',
    status: 'OPEN',
    opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    closed_at: null,
    opening_cash_php: 50000,
    closing_cash_php: null,
    expected_cash_php: null,
    cash_variance: null,
    txn_count: 2,
    total_sold_php: 11200,
    total_bought_php: 27750,
    total_than: 100,
    notes: null,
  }],
  ['cashier1', {
    id: 'shift-cashier1-today',
    date: today,
    cashier: 'cashier1',
    cashier_name: 'Cashier One',
    status: 'OPEN',
    opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), // 2h ago
    closed_at: null,
    opening_cash_php: 10000,
    closing_cash_php: null,
    expected_cash_php: null,
    cash_variance: null,
    txn_count: 3,
    total_sold_php: 29000,
    total_bought_php: 11500,
    total_than: 450,
    notes: null,
  }],
]);

function makeShiftOut(cashier) {
  const s = SHIFTS.get(cashier);
  if (!s || s.status !== 'OPEN') return null;
  return s;
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url    = (req.url ?? '').split('?')[0];
  const method = (req.method ?? 'GET').toUpperCase();

  // Auth login (form-encoded body)
  if (method === 'POST' && url === '/api/v1/auth/login') {
    const body   = await readBody(req);
    const params = new URLSearchParams(body);
    const username = params.get('username') ?? '';
    const user = USERS[username];
    if (!user) return json(res, { detail: 'Invalid credentials' }, 401);
    return json(res, {
      access_token: makeJWT(username, user.role),
      token_type:   'bearer',
      role:          user.role,
      full_name:     user.full_name,
    });
  }

  // Currencies (counter page server component)
  if (method === 'GET' && url === '/api/v1/currencies/') return json(res, CURRENCIES);

  // Currencies meta (rider page server component)
  if (method === 'GET' && url === '/api/v1/currencies/meta') return json(res, CURRENCIES);

  // Dashboard summary
  if (method === 'GET' && url === '/api/v1/dashboard/summary') return json(res, DASHBOARD_SUMMARY);

  // Banks (rider page — payment modes)
  if (method === 'GET' && url === '/api/v1/banks') return json(res, BANKS);

  // ── Special Credits ──────────────────────────────────────────────────────
  if (method === 'GET' && /^\/api\/v1\/credits\/?(\?.*)?$/.test(url)) {
    const qs = new URLSearchParams((url.split('?')[1] ?? ''));
    const sf = qs.get('status_filter');
    const result = sf ? CREDITS.filter(c => c.status === sf) : CREDITS;
    return json(res, result);
  }
  if (method === 'POST' && url === '/api/v1/credits/') {
    const body = JSON.parse(await readBody(req));
    const id = `credit-${Date.now()}`;
    const credit = {
      id,
      customer_name:  body.customer_name,
      currency_code:  body.currency_code,
      principal:      body.principal,
      interest:       body.interest,
      credit_type:    body.credit_type,
      status:         'ACTIVE',
      disbursed_date: body.disbursed_date,
      notes:          body.notes ?? null,
      created_by:     'admin',
      installments:   body.installments.map((inst, i) => ({
        id:             `inst-${id}-${i+1}`,
        installment_no: i + 1,
        due_date:       inst.due_date,
        amount:         inst.amount,
        paid_at:        null,
        received_by:    null,
      })),
      draws: [],
    };
    CREDITS.unshift(credit);
    return json(res, credit, 201);
  }
  if (method === 'GET' && /^\/api\/v1\/credits\/[^/]+$/.test(url)) {
    const id = url.split('/').pop();
    const credit = CREDITS.find(c => c.id === id);
    if (!credit) return json(res, { detail: 'Not found' }, 404);
    return json(res, credit);
  }
  if (method === 'PATCH' && /\/installments\/.+\/pay$/.test(url)) {
    const parts   = url.split('/');
    const creditId = parts[parts.indexOf('credits') + 1];
    const instId   = parts[parts.indexOf('installments') + 1];
    const credit = CREDITS.find(c => c.id === creditId);
    if (!credit) return json(res, { detail: 'Not found' }, 404);
    const inst = credit.installments.find(i => i.id === instId);
    if (!inst) return json(res, { detail: 'Not found' }, 404);
    inst.paid_at = new Date().toISOString().split('T')[0];
    inst.received_by = 'admin';
    if (credit.installments.every(i => i.paid_at)) credit.status = 'COMPLETED';
    return json(res, credit);
  }
  if (method === 'PATCH' && /\/credits\/.+\/cancel$/.test(url)) {
    const id = url.split('/').at(-2);
    const credit = CREDITS.find(c => c.id === id);
    if (!credit) return json(res, { detail: 'Not found' }, 404);
    credit.status = 'CANCELLED';
    return json(res, credit);
  }

  // Banks (admin manage banks page — server component)
  if (method === 'GET' && url === '/api/v1/admin/banks') return json(res, BANKS);
  if (method === 'POST' && url === '/api/v1/admin/banks') {
    const body = JSON.parse(await readBody(req));
    const newBank = { id: BANKS.length + 1, name: body.name, code: body.code, is_active: true, sort_order: BANKS.length + 1 };
    BANKS.push(newBank);
    return json(res, newBank, 201);
  }
  if (method === 'PATCH' && url === '/api/v1/admin/banks') return json(res, { message: 'Updated' });

  // Users list (admin rider dispatch form) — handle both /users and /users/
  if (method === 'GET' && (url === '/api/v1/users/' || url === '/api/v1/users')) return json(res, ALL_USERS);

  // Today's dispatches (rider tab)
  if (method === 'GET' && url === '/api/v1/rider/dispatches/today') return json(res, []);

  // Rider's own dispatch (balance card)
  if (method === 'GET' && url === '/api/v1/rider/my-dispatch') return json(res, { dispatch: null });

  // Borrows for a dispatch
  if (method === 'GET' && /^\/api\/v1\/rider\/borrows\//.test(url)) return json(res, []);

  // Dispatch a rider
  if (method === 'POST' && url === '/api/v1/rider/dispatches') {
    const body = await readBody(req);
    const data = JSON.parse(body);
    return json(res, {
      id:               'test-dispatch-001',
      date:              new Date().toISOString().split('T')[0],
      rider_username:    data.rider_username,
      rider_name:        USERS[data.rider_username]?.full_name ?? data.rider_username,
      status:           'IN_FIELD',
      dispatch_time:    '09:00 AM',
      return_time:       null,
      cash_php:          data.cash_php,
      notes:             data.notes ?? null,
      dispatched_by:    'admin',
    }, 201);
  }

  // Mark dispatch returned
  if (method === 'PATCH' && /^\/api\/v1\/rider\/dispatches\/.+\/return$/.test(url)) {
    return json(res, { message: 'Marked as returned' });
  }

  // My pending edit request IDs
  if (method === 'GET' && url === '/api/v1/transactions/my-pending-edits') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const user    = payload.sub ?? '';
    const ids = EDIT_REQUESTS
      .filter(r => r.requested_by === user && r.status === 'PENDING')
      .map(r => r.txn_id);
    return json(res, ids);
  }

  // Submit edit request
  if (method === 'POST' && /\/transactions\/([^/]+)\/edit-request$/.test(url)) {
    const txnId = url.split('/').at(-2);
    const auth  = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const txn = TODAY_TRANSACTIONS.find(t => t.id === txnId);
    if (!txn) return json(res, { detail: 'Transaction not found' }, 404);
    const existing = EDIT_REQUESTS.find(r => r.txn_id === txnId && r.status === 'PENDING');
    if (existing) return json(res, { detail: 'A pending edit request already exists for this transaction' }, 409);
    const body = JSON.parse(await readBody(req));
    const { note, ...proposed } = body;
    const req_obj = {
      id: `req-${Date.now()}`,
      txn_id: txnId,
      txn_date: today,
      requested_by: payload.sub ?? 'cashier1',
      current_values: { customer: txn.customer, payment_mode: txn.payment_mode, rate: txn.rate, foreign_amt: txn.foreign_amt, php_amt: txn.php_amt, than: txn.than },
      proposed,
      note: note ?? null,
      status: 'PENDING',
      reviewed_by: null, reviewed_at: null, rejection_note: null,
      created_at: new Date().toISOString(),
    };
    EDIT_REQUESTS.push(req_obj);
    return json(res, req_obj, 201);
  }

  // Admin: list edit requests
  if (method === 'GET' && url.startsWith('/api/v1/admin/edit-requests') && !url.includes('/approve') && !url.includes('/reject') && !url.includes('/pending-count')) {
    const qs     = new URLSearchParams((req.url ?? '').split('?')[1] ?? '');
    const status = qs.get('status');
    const result = status ? EDIT_REQUESTS.filter(r => r.status === status) : [...EDIT_REQUESTS];
    return json(res, result.reverse());
  }

  // Admin: pending count
  if (method === 'GET' && url === '/api/v1/admin/edit-requests/pending-count') {
    return json(res, { count: EDIT_REQUESTS.filter(r => r.status === 'PENDING').length });
  }

  // Admin: approve
  if (method === 'POST' && /\/admin\/edit-requests\/([^/]+)\/approve$/.test(url)) {
    const id = url.split('/').at(-2);
    const r  = EDIT_REQUESTS.find(x => x.id === id);
    if (!r) return json(res, { detail: 'Not found' }, 404);
    if (r.status !== 'PENDING') return json(res, { detail: `Already ${r.status}` }, 409);
    const txn = TODAY_TRANSACTIONS.find(t => t.id === r.txn_id);
    if (txn) Object.assign(txn, r.proposed);
    r.status      = 'APPROVED';
    r.reviewed_by = 'admin';
    r.reviewed_at = new Date().toISOString();
    return json(res, { status: 'approved' });
  }

  // Admin: reject
  if (method === 'POST' && /\/admin\/edit-requests\/([^/]+)\/reject$/.test(url)) {
    const id   = url.split('/').at(-2);
    const r    = EDIT_REQUESTS.find(x => x.id === id);
    if (!r) return json(res, { detail: 'Not found' }, 404);
    if (r.status !== 'PENDING') return json(res, { detail: `Already ${r.status}` }, 409);
    const body = JSON.parse(await readBody(req));
    r.status         = 'REJECTED';
    r.reviewed_by    = 'admin';
    r.reviewed_at    = new Date().toISOString();
    r.rejection_note = body.rejection_note ?? null;
    return json(res, { status: 'rejected' });
  }

  // Admin: direct PATCH transaction
  if (method === 'PATCH' && /^\/api\/v1\/transactions\/[^/]+$/.test(url)) {
    const id  = url.split('/').pop();
    const txn = TODAY_TRANSACTIONS.find(t => t.id === id);
    if (!txn) return json(res, { detail: 'Not found' }, 404);
    const body = JSON.parse(await readBody(req));
    Object.assign(txn, body);
    if (body.rate || body.foreign_amt) {
      txn.php_amt = Math.round(txn.foreign_amt * txn.rate * 100) / 100;
      if (txn.type === 'SELL') txn.than = Math.round((txn.rate - txn.daily_avg_cost) * txn.foreign_amt * 100) / 100;
    }
    return json(res, { id: txn.id, time: txn.time, type: txn.type, source: txn.source, currency: txn.currency_code, foreign_amt: txn.foreign_amt, rate: txn.rate, php_amt: txn.php_amt, than: txn.than, cashier: txn.cashier, customer: txn.customer, payment_mode: txn.payment_mode, bank_id: null });
  }

  // Transactions today (counter and rider)
  if (method === 'GET' && url === '/api/v1/transactions/today') return json(res, TODAY_TRANSACTIONS.map(t => ({ id: t.id, time: t.time, type: t.type, source: t.source, currency: t.currency_code, foreign_amt: t.foreign_amt, rate: t.rate, php_amt: t.php_amt, than: t.than, cashier: t.cashier, customer: t.customer, payment_mode: t.payment_mode, bank_id: null })));
  if (method === 'GET' && /transactions/.test(url)) return json(res, []);

  // Submit counter transaction
  if (method === 'POST' && url === '/api/v1/transactions/') {
    const body = await readBody(req);
    const data = JSON.parse(body);
    return json(res, {
      id:           'TXN-TEST-001',
      time:          new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
      type:          data.type,
      source:        data.source,
      currency:      data.currency,
      foreign_amt:   data.foreign_amt,
      rate:          data.rate,
      php_amt:       data.foreign_amt * data.rate,
      than:          0,
      cashier:       data.cashier,
      customer:      data.customer ?? null,
      payment_mode:  data.payment_mode ?? 'CASH',
    }, 201);
  }

  // Submit rider transaction
  if (method === 'POST' && /\/rider\/transactions/.test(url)) {
    const body = await readBody(req);
    const data = JSON.parse(body);
    return json(res, {
      id:           'RIDER-TXN-001',
      time:          new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
      type:          data.type,
      source:       'RIDER',
      currency:      data.currency,
      foreign_amt:   data.foreign_amt,
      rate:          data.rate,
      php_amt:       data.foreign_amt * data.rate,
      than:          0,
      cashier:       data.cashier,
      customer:      data.customer ?? null,
      payment_mode:  data.payment_mode ?? 'CASH',
    }, 201);
  }

  // Positions today (admin positions page)
  if (method === 'GET' && url === '/api/v1/positions/today') {
    return json(res, CURRENCIES.map(c => ({
      code: c.code, name: c.name, flag: c.flag, category: c.category,
      decimal_places: c.decimal_places,
      carry_in_qty: 0, carry_in_rate: 0, position_set: false,
    })));
  }

  // Rates today (admin rates page)
  if (method === 'GET' && url === '/api/v1/rates/today') return json(res, []);

  // POST rates
  if (method === 'POST' && url === '/api/v1/rates/today') {
    return json(res, { message: 'Rates saved' });
  }

  // Daily report (admin report page — server component)
  if (method === 'GET' && /^\/api\/v1\/report\/daily/.test(url)) {
    return json(res, {
      date:               today,
      generated_at:       new Date().toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' }),
      total_transactions: 3,
      total_bought_php:   46250,
      total_sold_php:     11200,
      total_than:         100,
      by_currency: [
        { code:'USD', name:'US Dollar',     flag:'🇺🇸', category:'MAIN', decimal_places:2,
          buy_count:1, buy_qty:500,   buy_php:27750, sell_count:1, sell_qty:200, sell_php:11200, than:100 },
        { code:'JPY', name:'Japanese Yen',  flag:'🇯🇵', category:'MAIN', decimal_places:0,
          buy_count:1, buy_qty:50000, buy_php:18500, sell_count:0, sell_qty:0,   sell_php:0,    than:0   },
      ],
      by_cashier: [
        { cashier:'cashier1', buy_count:2, buy_php:46250, sell_count:1, sell_php:11200, than:100 },
      ],
      transactions: [
        { id:'TXN-001', time:'09:30 AM', type:'BUY',  source:'COUNTER', currency:'USD', foreign_amt:500,   rate:55.50, php_amt:27750, than:0,   cashier:'cashier1', customer:'Juan dela Cruz' },
        { id:'TXN-002', time:'10:15 AM', type:'BUY',  source:'COUNTER', currency:'JPY', foreign_amt:50000, rate:0.37,  php_amt:18500, than:0,   cashier:'cashier1', customer:'Walk-in' },
        { id:'TXN-003', time:'11:00 AM', type:'SELL', source:'COUNTER', currency:'USD', foreign_amt:200,   rate:56.00, php_amt:11200, than:100, cashier:'cashier1', customer:'Maria Santos' },
      ],
      special_credits: {
        disbursements: [
          { id: 'credit-001', customer_name: 'Sample Customer', currency_code: 'PHP', principal: 50000, interest: 2500, credit_type: 'UPFRONT', cash_out: 47500 },
        ],
        payments: [],
        total_cash_out: 47500,
        total_cash_in: 0,
        interest_income: 2500,
      },
    });
  }

  // EOD positions (used by admin/eod and admin/positions backends)
  if (method === 'POST' && url === '/api/v1/eod/close') return json(res, { message: 'Day closed.' });
  if (method === 'POST' && url === '/api/v1/positions/today') return json(res, { message: 'Positions saved.' });

  // Audit log
  if (method === 'GET' && url === '/api/v1/audit/log') {
    const qs     = new URLSearchParams((req.url ?? '').split('?')[1] ?? '');
    const table  = qs.get('table');
    const action = qs.get('action');
    const user   = qs.get('user');
    let results  = [...AUDIT_LOG];
    if (table)  results = results.filter(e => e.table      === table);
    if (action) results = results.filter(e => e.action     === action);
    if (user)   results = results.filter(e => e.changed_by === user);
    return json(res, results);
  }

  // ── Shifts ───────────────────────────────────────────────────────────────
  // GET /api/v1/shifts/active — returns open shift for current cashier or 404
  if (method === 'GET' && url === '/api/v1/shifts/active') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const shift   = makeShiftOut(payload.sub);
    if (!shift) return json(res, { detail: 'No active shift.' }, 404);
    return json(res, shift);
  }

  // POST /api/v1/shifts/open
  if (method === 'POST' && url === '/api/v1/shifts/open') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const cashier = payload.sub ?? 'cashier1';
    const body    = JSON.parse(await readBody(req));
    if (SHIFTS.has(cashier) && SHIFTS.get(cashier).status === 'OPEN') {
      return json(res, { detail: 'You already have an open shift today.' }, 409);
    }
    const shift = {
      id: `shift-${cashier}-${Date.now()}`,
      date: today,
      cashier,
      cashier_name: USERS[cashier]?.full_name ?? cashier,
      status: 'OPEN',
      opened_at: new Date().toISOString(),
      closed_at: null,
      opening_cash_php: body.opening_cash_php,
      closing_cash_php: null,
      expected_cash_php: null,
      cash_variance: null,
      txn_count: 0,
      total_sold_php: 0,
      total_bought_php: 0,
      total_than: 0,
      notes: body.notes ?? null,
    };
    SHIFTS.set(cashier, shift);
    return json(res, shift, 201);
  }

  // POST /api/v1/shifts/close
  if (method === 'POST' && url === '/api/v1/shifts/close') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const cashier = payload.sub ?? 'cashier1';
    const body    = JSON.parse(await readBody(req));
    const shift   = SHIFTS.get(cashier);
    if (!shift || shift.status !== 'OPEN') {
      return json(res, { detail: 'No open shift found for today.' }, 404);
    }
    const expected = Math.round((shift.opening_cash_php + shift.total_sold_php - shift.total_bought_php) * 100) / 100;
    const variance = Math.round((body.closing_cash_php - expected) * 100) / 100;
    Object.assign(shift, {
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
      closing_cash_php: body.closing_cash_php,
      expected_cash_php: expected,
      cash_variance: variance,
    });
    return json(res, shift);
  }

  // GET /api/v1/shifts/today — admin view
  if (method === 'GET' && url === '/api/v1/shifts/today') {
    return json(res, [...SHIFTS.values()]);
  }

  // ── Date override (test mode) ────────────────────────────────────────────
  if (method === 'GET' && url === '/api/v1/config/test-date') {
    return json(res, { test_date: mockTestDate });
  }
  if (method === 'POST' && url === '/api/v1/config/test-date') {
    const body = JSON.parse(await readBody(req));
    mockTestDate = body.date ?? null;
    return json(res, { test_date: mockTestDate, message: `Test date set to ${mockTestDate}` });
  }
  if (method === 'DELETE' && url === '/api/v1/config/test-date') {
    mockTestDate = null;
    return json(res, { message: 'Test date cleared' });
  }

  // Test reset — clears mutable state between tests
  if (method === 'POST' && url === '/api/v1/test/reset') {
    mockTestDate = null;
    EDIT_REQUESTS.length = 0;
    CREDITS = makeInitialCredits();
    // Restore both shifts to OPEN state
    SHIFTS.set('cashier1', {
      id: 'shift-cashier1-today', date: today,
      cashier: 'cashier1', cashier_name: 'Cashier One', status: 'OPEN',
      opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), closed_at: null,
      opening_cash_php: 10000, closing_cash_php: null, expected_cash_php: null, cash_variance: null,
      txn_count: 3, total_sold_php: 29000, total_bought_php: 11500, total_than: 450, notes: null,
    });
    SHIFTS.set('admin', {
      id: 'shift-admin-today', date: today,
      cashier: 'admin', cashier_name: 'Admin User', status: 'OPEN',
      opened_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(), closed_at: null,
      opening_cash_php: 50000, closing_cash_php: null, expected_cash_php: null, cash_variance: null,
      txn_count: 2, total_sold_php: 11200, total_bought_php: 27750, total_than: 100, notes: null,
    });
    return json(res, { ok: true });
  }

  // Fallback
  console.warn(`[mock-api] Unhandled: ${method} ${url}`);
  json(res, { detail: 'Not found' }, 404);
});

server.listen(9999, () => {
  console.log('[mock-api] Running on http://localhost:9999');
});
