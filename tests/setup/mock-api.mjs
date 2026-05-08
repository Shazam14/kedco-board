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

// ── Customers (loyal-customer master list) ───────────────────────────────────
// Stats fields (txn_count, total_volume_php, last_txn_date) are mocked in
// directly so /admin/customers tests can verify the enriched list without
// needing to also seed transactions.
function makeInitialCustomers() {
  const now = new Date().toISOString();
  return [
    { id: 'cust-hannah-wu', name: 'Hannah Wu',  phone: '09171234567', notes: null,
      is_active: true, merged_into_id: null, created_by: 'admintest', created_at: now,
      txn_count: 12, total_volume_php: 480000, last_txn_date: '2026-04-29',
      top_currencies: ['USD', 'JPY'] },
    { id: 'cust-pedro-cruz', name: 'Pedro Cruz', phone: null,         notes: null,
      is_active: true, merged_into_id: null, created_by: 'admintest', created_at: now,
      txn_count: 3, total_volume_php: 95000, last_txn_date: '2026-04-25',
      top_currencies: ['EUR'] },
    // Suspected dupe of Hannah Wu — used by merge tests
    { id: 'cust-hanna-wuu', name: 'Hanna Wuu',  phone: null, notes: null,
      is_active: true, merged_into_id: null, created_by: 'admintest', created_at: now,
      txn_count: 2, total_volume_php: 18000, last_txn_date: '2026-04-22',
      top_currencies: ['USD'] },
  ];
}
let CUSTOMERS = makeInitialCustomers();

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
// Per-credit ledger entries: { [creditId]: LedgerEntry[] }
let LEDGER = { 'credit-001': [] };

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

// ── Safe / vault movements (mutable, resets on each mock-api start) ──────────
const SAFE_MOVEMENTS = [];

// ── PHP Capital ledger (mutable, resets on each mock-api start) ──────────────
const CAPITAL_ENTRIES = [];

// ── Branch Capital (mutable, resets on each mock-api start) ─────────────────
const BRANCH_CAPITAL = [];

// ── Peso Ken ledger (mutable, resets on each mock-api start) ────────────────
const PESO_KEN_ENTRIES = [];

// ── Misc ledger (mutable, resets on each mock-api start) ────────────────────
const MISC_ENTRIES = [];

// ── Investors (mutable, resets on each mock-api start) ──────────────────────
const INVESTORS = [];

// ── Pending cheques (mutable, resets on each mock-api start) ────────────────
const PENDING_CHEQUES = [
  {
    payment_id: 'pay-cheque-001',
    txn_id: 'OR-TESTCHEQ',
    txn_date: new Date().toISOString().split('T')[0],
    amount_php: 50000,
    reference_no: 'CHK-12345',
    customer: 'Acme Corp',
    cashier: 'cashier1',
  },
];

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

function withTreasurerView(s) {
  if (!s) return s;
  const isTreasurer = USERS[s.cashier]?.role === 'supervisor';
  if (!isTreasurer) {
    return { ...s, is_treasurer_shift: false };
  }
  const bale = (s.replenishments ?? [])
    .filter(r => r.source === 'SAFE')
    .reduce((sum, r) => sum + r.amount_php, 0);
  return {
    ...s,
    is_treasurer_shift:        true,
    overall_total_bought_php:  s.overall_total_bought_php ?? 0,
    overall_total_sold_php:    s.overall_total_sold_php   ?? 0,
    from_dispatches_php:       s.from_dispatches_php       ?? 0,
    from_cashier_php:          s.from_cashier_php          ?? 0,
    bale_peso_php:             bale,
    vault_returns_php:         s.vault_returns_php ?? 0,
    dispatches_out_php:        s.dispatches_out_php ?? 0,
  };
}

function makeShiftOut(cashier) {
  const s = SHIFTS.get(cashier);
  if (!s || s.status !== 'OPEN') return null;
  return withTreasurerView(s);
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
  // Ledger — GET (with optional date filter) + POST
  if (method === 'GET' && /^\/api\/v1\/credits\/[^/]+\/ledger$/.test(url)) {
    const id = url.split('/')[4];
    const credit = CREDITS.find(c => c.id === id);
    if (!credit) return json(res, { detail: 'Not found' }, 404);
    const qs = new URLSearchParams((req.url ?? '').split('?')[1] ?? '');
    const from = qs.get('from_date');
    const to   = qs.get('to_date');
    const all = (LEDGER[id] ?? []).slice().sort((a, b) => (a.date + (a.created_at ?? '')).localeCompare(b.date + (b.created_at ?? '')));
    const filt = all.filter(e => (!from || e.date >= from) && (!to || e.date <= to));
    let opening = null;
    if (from) {
      const prior = all.filter(e => e.date < from);
      opening = prior.length ? prior[prior.length - 1].balance : null;
    }
    const closing = filt.length ? filt[filt.length - 1].balance : opening;
    return json(res, {
      entries: filt,
      summary: {
        palod_sum: filt.reduce((s, e) => s + (e.palod ?? 0), 0),
        than_sum:  filt.reduce((s, e) => s + (e.than  ?? 0), 0),
        bayad_sum: filt.reduce((s, e) => s + (e.bayad ?? 0), 0),
        opening_balance: opening,
        closing_balance: closing,
        count: filt.length,
      },
    });
  }
  if (method === 'POST' && /^\/api\/v1\/credits\/[^/]+\/ledger$/.test(url)) {
    const id = url.split('/')[4];
    const credit = CREDITS.find(c => c.id === id);
    if (!credit) return json(res, { detail: 'Not found' }, 404);
    const body = JSON.parse(await readBody(req));
    const palod = body.palod || 0, than = body.than || 0, bayad = body.bayad || 0;
    if (palod < 0 || than < 0 || bayad < 0) return json(res, { detail: 'must be non-negative' }, 400);
    if (palod === 0 && than === 0 && bayad === 0) return json(res, { detail: 'one of palod/than/bayad required' }, 400);
    const list = LEDGER[id] ?? (LEDGER[id] = []);
    const last = list.length ? list[list.length - 1] : null;
    const prior = last && last.balance != null ? last.balance : 0;
    const balance = Math.round((prior + palod + than - bayad) * 100) / 100;
    const entry = {
      id: `ledger-${Date.now()}`,
      date: body.date,
      time: body.time ?? null,
      description: body.description ?? null,
      palod, than, bayad, balance,
      created_by: 'admin',
      created_at: new Date().toISOString(),
    };
    list.push(entry);
    return json(res, entry, 201);
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

  // ── Customers (autocomplete + add) ─────────────────────────────────────────
  if (method === 'GET' && url.startsWith('/api/v1/customers') && !url.match(/\/customers\/[a-z0-9-]+$/i)) {
    // url is path-only (mock-api strips ?... at line 247) — re-parse from req.url
    const u = new URL(req.url ?? '', 'http://x');
    const q = (u.searchParams.get('q') ?? '').trim().toLowerCase();
    const limit = Number(u.searchParams.get('limit') ?? '20');
    let rows = CUSTOMERS.filter(c => c.is_active);
    if (q) rows = rows.filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q)
    );
    return json(res, rows.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit));
  }
  if (method === 'POST' && url === '/api/v1/customers') {
    const body = JSON.parse(await readBody(req));
    const name = (body.name ?? '').trim();
    if (!name) return json(res, { detail: 'Customer name is required' }, 400);
    const newCustomer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name, phone: body.phone ?? null, notes: body.notes ?? null,
      is_active: true, created_by: 'mocked', created_at: new Date().toISOString(),
    };
    CUSTOMERS.push(newCustomer);
    return json(res, newCustomer, 201);
  }
  if (method === 'GET' && /^\/api\/v1\/customers\/[^/]+$/.test(url)) {
    const id = url.split('/').pop();
    const c = CUSTOMERS.find(x => x.id === id);
    if (!c) return json(res, { detail: 'Customer not found' }, 404);
    return json(res, c);
  }
  // Admin per-customer detail — GET /api/v1/admin/customers/{id}/detail
  {
    const m = url.match(/^\/api\/v1\/admin\/customers\/([^/]+)\/detail$/);
    if (method === 'GET' && m) {
      const id = m[1];
      const c = CUSTOMERS.find(x => x.id === id);
      if (!c) return json(res, { detail: 'Customer not found' }, 404);
      const today = new Date().toISOString().slice(0, 10);
      // Simple deterministic mock: synthesize a single bucket / a couple of mock txns
      // when the customer has a non-zero txn_count, so the detail page renders.
      const has = (c.txn_count ?? 0) > 0;
      return json(res, {
        customer: {
          id: c.id, name: c.name, phone: c.phone, notes: c.notes,
          is_active: c.is_active, created_by: c.created_by, created_at: c.created_at,
        },
        stats: {
          txn_count: c.txn_count ?? 0,
          total_volume_php: c.total_volume_php ?? 0,
          last_txn_date: c.last_txn_date ?? null,
          first_txn_date: has ? '2026-04-01' : null,
        },
        currency_mix: has
          ? [
              { currency: 'USD', txn_count: Math.ceil((c.txn_count ?? 0) * 0.6), total_foreign: 4500, total_php: (c.total_volume_php ?? 0) * 0.7 },
              { currency: 'JPY', txn_count: Math.floor((c.txn_count ?? 0) * 0.4), total_foreign: 250000, total_php: (c.total_volume_php ?? 0) * 0.3 },
            ]
          : [],
        weekly: has
          ? [
              { period: today + 'T00:00:00', txn_count: c.txn_count ?? 0, total_php: c.total_volume_php ?? 0 },
            ]
          : [],
        annual: has
          ? [
              { period: '2026-01-01T00:00:00', txn_count: c.txn_count ?? 0, total_php: c.total_volume_php ?? 0 },
            ]
          : [],
        recent_transactions: has
          ? [
              { id: 'OR-DETAIL-1', date: c.last_txn_date ?? today, time: '10:15 AM',
                type: 'SELL', source: 'COUNTER', currency: 'USD', foreign_amt: 100, rate: 58, php_amt: 5800,
                than: 50, cashier: 'cashier1', payment_status: 'RECEIVED' },
              { id: 'OR-DETAIL-2', date: c.last_txn_date ?? today, time: '11:30 AM',
                type: 'BUY',  source: 'RIDER',   currency: 'JPY', foreign_amt: 50000, rate: 0.37, php_amt: 18500,
                than: 0, cashier: 'rider01',  payment_status: 'RECEIVED' },
            ]
          : [],
      });
    }
  }

  // Admin merge — POST /api/v1/admin/customers/{canonical_id}/merge
  {
    const m = url.match(/^\/api\/v1\/admin\/customers\/([^/]+)\/merge$/);
    if (method === 'POST' && m) {
      const canonicalId = m[1];
      const body = JSON.parse(await readBody(req));
      const dupeIds = Array.isArray(body.duplicate_ids) ? body.duplicate_ids : [];
      const canonical = CUSTOMERS.find(c => c.id === canonicalId);
      if (!canonical) return json(res, { detail: 'Canonical customer not found' }, 404);
      if (!canonical.is_active || canonical.merged_into_id) {
        return json(res, { detail: 'Canonical customer is inactive or already merged' }, 400);
      }
      if (dupeIds.includes(canonicalId)) {
        return json(res, { detail: 'Cannot merge a customer into itself' }, 400);
      }
      const dupes = dupeIds.map(id => CUSTOMERS.find(c => c.id === id));
      if (dupes.some(d => !d)) return json(res, { detail: 'One or more duplicate ids not found' }, 400);
      if (dupes.some(d => d.merged_into_id)) {
        return json(res, { detail: 'Customer already merged — chain merges not supported' }, 400);
      }
      // Roll up txn counts + volume into canonical, then soft-delete dupes
      let repointed = 0;
      for (const d of dupes) {
        canonical.txn_count       = (canonical.txn_count ?? 0) + (d.txn_count ?? 0);
        canonical.total_volume_php = (canonical.total_volume_php ?? 0) + (d.total_volume_php ?? 0);
        if (d.last_txn_date && (!canonical.last_txn_date || d.last_txn_date > canonical.last_txn_date)) {
          canonical.last_txn_date = d.last_txn_date;
        }
        repointed += d.txn_count ?? 0;
        d.is_active = false;
        d.merged_into_id = canonicalId;
      }
      return json(res, {
        canonical_id: canonicalId,
        merged_count: dupes.length,
        transactions_repointed: repointed,
      });
    }
  }

  // Admin enriched customer list (with txn_count, total_volume_php, last_txn_date)
  if (method === 'GET' && url.startsWith('/api/v1/admin/customers')) {
    // url is path-only (mock-api strips ?... at line 247) — re-parse from req.url
    const u = new URL(req.url ?? '', 'http://x');
    const q = (u.searchParams.get('q') ?? '').trim().toLowerCase();
    const includeInactive = u.searchParams.get('include_inactive') === 'true';
    const limit = Number(u.searchParams.get('limit') ?? '100');
    let rows = includeInactive ? CUSTOMERS : CUSTOMERS.filter(c => c.is_active);
    if (q) rows = rows.filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q)
    );
    const enriched = rows.map(c => ({
      ...c,
      txn_count: c.txn_count ?? 0,
      total_volume_php: c.total_volume_php ?? 0,
      last_txn_date: c.last_txn_date ?? null,
      top_currencies: c.top_currencies ?? [],
    }));
    enriched.sort((a, b) => b.total_volume_php - a.total_volume_php);
    return json(res, enriched.slice(0, limit));
  }

  // Petty-cash / expenses — minimal stubs (see test_expense_shift_scope.py for real coverage).
  // Cashier per-shift scoping is enforced server-side; tests don't currently exercise it via UI.
  if (method === 'GET' && url === '/api/v1/expenses/today') return json(res, []);
  if (method === 'GET' && url === '/api/v1/expenses/categories') {
    return json(res, [
      'OFFICE_SUPPLIES', 'UTILITIES', 'TRANSPORTATION', 'MEALS',
      'MAINTENANCE', 'SALARY_ADVANCE', 'BANK_CHARGES', 'COMMISSION_PAYOUT', 'OTHERS',
    ]);
  }

  // Users list (admin rider dispatch form) — handle both /users and /users/
  if (method === 'GET' && (url === '/api/v1/users/' || url === '/api/v1/users')) return json(res, ALL_USERS);

  // Riders only — used by /admin/riders page (allows admin + supervisor on real API)
  if (method === 'GET' && url === '/api/v1/users/riders') return json(res, ALL_USERS.filter(u => u.role === 'rider'));

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
      remit_php:         null,
      items:             [],
      remit_items:       [],
      topups:            [],
      notes:             data.notes ?? null,
      dispatched_by:    'admin',
    }, 201);
  }

  // Top up an existing dispatch
  if (method === 'POST' && /^\/api\/v1\/rider\/dispatches\/.+\/topup$/.test(url)) {
    const id = url.split('/').slice(-2)[0];
    const body = JSON.parse(await readBody(req));
    return json(res, {
      id,
      date:           new Date().toISOString().split('T')[0],
      rider_username:'rider01',
      rider_name:    'Rider 01',
      status:        'IN_FIELD',
      dispatch_time: '09:00 AM',
      return_time:    null,
      cash_php:       (body.amount_php ?? 0) + 100000,
      remit_php:      null,
      items:          [],
      remit_items:    [],
      topups: [{
        id:           'topup-' + Date.now(),
        amount_php:   body.amount_php,
        time:        '10:30 AM',
        dispatched_by:'admin',
        notes:        body.notes ?? null,
      }],
      notes:          null,
      dispatched_by: 'admin',
    });
  }

  // Mark dispatch returned
  if (method === 'PATCH' && /^\/api\/v1\/rider\/dispatches\/.+\/return$/.test(url)) {
    return json(res, { message: 'Marked as returned' });
  }

  // Confirm payment on a transaction (treasurer payables flow)
  if (method === 'PATCH' && /^\/api\/v1\/rider\/transactions\/.+\/confirm-payment$/.test(url)) {
    return json(res, { message: 'Payment confirmed', confirmed_by: 'treasurer1' });
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

  // Link customer to txn — same-day, owner-or-admin
  if (method === 'POST' && /^\/api\/v1\/transactions\/[^/]+\/customer$/.test(url)) {
    const id  = url.split('/').slice(-2)[0];
    const txn = TODAY_TRANSACTIONS.find(t => t.id === id);
    if (!txn) return json(res, { detail: 'Transaction not found' }, 404);
    const body = JSON.parse(await readBody(req));
    if (body.customer_id) {
      const c = CUSTOMERS.find(x => x.id === body.customer_id && x.is_active);
      if (!c) return json(res, { detail: 'Unknown customer' }, 400);
      txn.customer_id = c.id;
      txn.customer = c.name;
    } else {
      txn.customer_id = null;
    }
    return json(res, { id: txn.id, time: txn.time, type: txn.type, source: txn.source, currency: txn.currency_code, foreign_amt: txn.foreign_amt, rate: txn.rate, php_amt: txn.php_amt, than: txn.than, cashier: txn.cashier, customer: txn.customer, customer_id: txn.customer_id ?? null, payment_mode: txn.payment_mode, bank_id: null, payment_status: txn.payment_status ?? 'RECEIVED', branch_id: txn.branch_id ?? null });
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
    return json(res, { id: txn.id, time: txn.time, type: txn.type, source: txn.source, currency: txn.currency_code, foreign_amt: txn.foreign_amt, rate: txn.rate, php_amt: txn.php_amt, than: txn.than, cashier: txn.cashier, customer: txn.customer, payment_mode: txn.payment_mode, bank_id: null, payment_status: txn.payment_status ?? 'RECEIVED' });
  }

  // Transactions today (counter and rider)
  if (method === 'GET' && url === '/api/v1/transactions/today') return json(res, TODAY_TRANSACTIONS.map(t => ({ id: t.id, time: t.time, type: t.type, source: t.source, currency: t.currency_code, foreign_amt: t.foreign_amt, rate: t.rate, php_amt: t.php_amt, than: t.than, cashier: t.cashier, customer: t.customer, customer_id: t.customer_id ?? null, payment_mode: t.payment_mode, bank_id: null, payment_status: t.payment_status ?? 'RECEIVED', branch_id: t.branch_id ?? null, payments: [{ id: `${t.id}-p0`, method: t.payment_mode ?? 'CASH', amount_php: t.php_amt, status: t.payment_status ?? 'RECEIVED', reference_no: null, received_at: null, confirmed_by: null }] })));
  if (method === 'GET' && /transactions/.test(url)) return json(res, []);

  // Submit batch counter transaction
  if (method === 'POST' && url === '/api/v1/transactions/batch') {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const time = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    return json(res, data.items.map((item, i) => ({
      id:           `TXN-BATCH-${String(i + 1).padStart(3, '0')}`,
      time,
      type:         data.type,
      source:       data.source ?? 'COUNTER',
      currency:     item.currency,
      foreign_amt:  item.foreign_amt,
      rate:         item.rate,
      php_amt:      item.foreign_amt * item.rate,
      than:         0,
      cashier:      'cashier1',
      customer:     data.customer ?? null,
      customer_id:  data.customer_id ?? null,
      payment_mode: data.payment_mode ?? 'CASH',
      payment_status: 'RECEIVED',
      batch_id:     'mock-batch-uuid',
    })), 201);
  }

  // Submit counter transaction (also used by rider proxy)
  if (method === 'POST' && url === '/api/v1/transactions/') {
    const body = await readBody(req);
    const data = JSON.parse(body);
    const phpAmt = data.foreign_amt * data.rate;
    const riderForcePendingNoncash = data.source === 'RIDER' && (data.type === 'SELL' || data.type === 'BUY');
    let slices;
    if (Array.isArray(data.payments) && data.payments.length > 0) {
      const sum = data.payments.reduce((s, p) => s + (p.amount_php ?? 0), 0);
      if (Math.abs(sum - phpAmt) > 0.01) {
        return json(res, { detail: `Sum of payments (${sum.toFixed(2)}) does not match php_amt (${phpAmt.toFixed(2)})` }, 400);
      }
      slices = data.payments.map((p, i) => {
        const method = (p.method ?? 'CASH').toUpperCase();
        const forced = riderForcePendingNoncash && method !== 'CASH';
        const status = forced ? 'PENDING' : (p.status ?? 'RECEIVED');
        return {
          id: `TXN-TEST-001-p${i}`,
          method,
          amount_php: p.amount_php,
          status,
          reference_no: p.reference_no ?? null,
          received_at: status === 'RECEIVED' ? new Date().toISOString() : null,
          confirmed_by: status === 'RECEIVED' ? data.cashier : null,
        };
      });
    } else {
      const method = (data.payment_mode ?? 'CASH').toUpperCase();
      const forced = riderForcePendingNoncash && method !== 'CASH';
      const status = forced ? 'PENDING' : (data.payment_status ?? 'RECEIVED');
      slices = [{
        id: 'TXN-TEST-001-p0',
        method,
        amount_php: phpAmt,
        status,
        reference_no: null,
        received_at: status === 'RECEIVED' ? new Date().toISOString() : null,
        confirmed_by: status === 'RECEIVED' ? data.cashier : null,
      }];
    }
    const parentStatus = slices.some(s => s.status === 'PENDING') ? 'PENDING' : 'RECEIVED';
    return json(res, {
      id:            'TXN-TEST-001',
      time:           new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
      type:           data.type,
      source:         data.source,
      currency:       data.currency,
      foreign_amt:    data.foreign_amt,
      rate:           data.rate,
      php_amt:        phpAmt,
      than:           0,
      cashier:        data.cashier,
      customer:       data.customer ?? null,
      customer_id:    data.customer_id ?? null,
      payment_mode:   slices[0].method,
      payment_status: parentStatus,
      payments:       slices,
    }, 201);
  }

  // Submit rider transaction
  if (method === 'POST' && /\/rider\/transactions/.test(url)) {
    const body = await readBody(req);
    const data = JSON.parse(body);
    // Mirror the API rule: rider non-cash slices force PENDING regardless of client (BUY or SELL).
    const pmode = (data.payment_mode ?? 'CASH').toUpperCase();
    const forcedPending = (data.type === 'SELL' || data.type === 'BUY') && pmode !== 'CASH';
    const finalStatus = forcedPending ? 'PENDING' : (data.payment_status ?? 'RECEIVED');
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
      customer_id:   data.customer_id ?? null,
      payment_mode:  data.payment_mode ?? 'CASH',
      payment_status: finalStatus,
    }, 201);
  }

  // Positions today (admin positions page)
  if (method === 'GET' && url === '/api/v1/positions/today') {
    return json(res, CURRENCIES.map(c => ({
      code: c.code, name: c.name, flag: c.flag, category: c.category,
      decimal_places: c.decimal_places,
      carry_in_qty: 0, carry_in_rate: 0, position_set: true,
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
      total_commission:    0,
      total_opening_stock_php: 0,
      total_closing_stock_php: 0,
      opening_positions:  [],
      stock_summary:      [],
      total_sold_php_pending: 3600,
      total_than_pending:     32.14,
      pending_count:          1,
      by_currency: [
        { code:'USD', name:'US Dollar',     flag:'🇺🇸', category:'MAIN', decimal_places:2,
          buy_count:1, buy_qty:500,   buy_php:27750, sell_count:1, sell_qty:200, sell_php:11200, than:100,
          sell_php_pending: 3600, than_pending: 32.14 },
        { code:'JPY', name:'Japanese Yen',  flag:'🇯🇵', category:'MAIN', decimal_places:0,
          buy_count:1, buy_qty:50000, buy_php:18500, sell_count:0, sell_qty:0,   sell_php:0,    than:0,
          sell_php_pending: 0, than_pending: 0 },
      ],
      by_cashier: [
        { cashier:'cashier1', buy_count:2, buy_php:46250, sell_count:1, sell_php:11200, than:100, commission:0 },
      ],
      by_payment_method: [
        { method:'CASH',  buy_count:2, buy_php:46250, sell_count:1, sell_php:7600,  sell_php_received:7600, sell_php_pending:0 },
        { method:'GCASH', buy_count:0, buy_php:0,     sell_count:1, sell_php:3600,  sell_php_received:0,    sell_php_pending:3600 },
      ],
      transactions: [
        { id:'TXN-001', time:'09:30 AM', type:'BUY',  source:'COUNTER', currency:'USD', foreign_amt:500,   rate:55.50, php_amt:27750, than:0,   cashier:'cashier1', customer:'Juan dela Cruz', payment_status:'RECEIVED',
          payments: [{ id:'p1', method:'CASH', amount_php:27750, status:'RECEIVED', reference_no:null }] },
        { id:'TXN-002', time:'10:15 AM', type:'BUY',  source:'COUNTER', currency:'JPY', foreign_amt:50000, rate:0.37,  php_amt:18500, than:0,   cashier:'cashier1', customer:'Walk-in', payment_status:'RECEIVED',
          payments: [{ id:'p2', method:'CASH', amount_php:18500, status:'RECEIVED', reference_no:null }] },
        { id:'TXN-003', time:'11:00 AM', type:'SELL', source:'COUNTER', currency:'USD', foreign_amt:200,   rate:56.00, php_amt:11200, than:100, cashier:'cashier1', customer:'Maria Santos', payment_status:'PENDING',
          payments: [
            { id:'p3a', method:'CASH',  amount_php:7600, status:'RECEIVED', reference_no:null },
            { id:'p3b', method:'GCASH', amount_php:3600, status:'PENDING',  reference_no:'GC-MS-1' },
          ] },
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
      peso: {
        opening_php: 2500000,
        closing_php: 2750000,
        bale_php: 100000,
        inter_branch_in_php: 0,
        vault_returns_php: 50000,
        cheques_cleared_php: 25000,
        expenses_php: 5000,
        rider_remits_php: 0,
        dispatched_out_php: 0,
        from_cashier_php: 180000,
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

  // GET /api/v1/treasurer/pending-float — returns null (no pre-fill) in tests
  if (method === 'GET' && url.startsWith('/api/v1/treasurer/pending-float')) {
    return json(res, null);
  }

  // GET /api/v1/treasurer/cheques/pending — list of uncleared cheques
  if (method === 'GET' && url === '/api/v1/treasurer/cheques/pending') {
    return json(res, PENDING_CHEQUES);
  }

  // POST /api/v1/treasurer/cheques/:id/clear — stamp cleared
  {
    const m = method === 'POST' && url.match(/^\/api\/v1\/treasurer\/cheques\/([^/]+)\/clear$/);
    if (m) {
      const pid = m[1];
      const idx = PENDING_CHEQUES.findIndex(c => c.payment_id === pid);
      if (idx === -1) return json(res, { detail: 'Cheque payment not found' }, 404);
      const [cleared] = PENDING_CHEQUES.splice(idx, 1);
      const auth = (req.headers['authorization'] ?? '').replace('Bearer ', '');
      const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
      return json(res, {
        payment_id: cleared.payment_id,
        cleared_at: new Date().toISOString(),
        cleared_by: payload.sub ?? 'treasurer1',
      });
    }
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
    return json(res, withTreasurerView(shift), 201);
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
    const isTreasurer = USERS[cashier]?.role === 'supervisor';
    const petty = shift.total_petty_cash_php ?? 0;
    let expected, variance;
    if (isTreasurer) {
      const fromDisp = shift.from_dispatches_php ?? 0;
      const dispOut  = shift.dispatches_out_php  ?? 0;
      const fromCash = shift.from_cashier_php    ?? 0;
      const bale     = (shift.replenishments ?? [])
        .filter(r => r.source === 'SAFE')
        .reduce((sum, r) => sum + r.amount_php, 0);
      const vaultReturns = shift.vault_returns_php ?? 0;
      expected = Math.round((shift.opening_cash_php + fromDisp - dispOut + fromCash - bale + vaultReturns) * 100) / 100;
      variance = Math.round((body.closing_cash_php - expected) * 100) / 100;
    } else {
      expected = Math.round((shift.opening_cash_php + shift.total_sold_php - shift.total_bought_php - petty) * 100) / 100;
      variance = Math.round((body.closing_cash_php - expected) * 100) / 100;
    }
    Object.assign(shift, {
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
      closing_cash_php: body.closing_cash_php,
      expected_cash_php: expected,
      cash_variance: variance,
    });
    return json(res, withTreasurerView(shift));
  }

  // GET /api/v1/shifts/today — admin view
  if (method === 'GET' && url === '/api/v1/shifts/today') {
    return json(res, [...SHIFTS.values()].map(withTreasurerView));
  }

  // POST /api/v1/shifts/replenish — also writes a paired safe movement when source=SAFE
  if (method === 'POST' && url === '/api/v1/shifts/replenish') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const cashier = payload.sub ?? 'cashier1';
    const body    = JSON.parse(await readBody(req));
    const shift   = SHIFTS.get(cashier);
    if (!shift || shift.status !== 'OPEN') {
      return json(res, { detail: 'No open shift found for today.' }, 404);
    }
    const source = (body.source ?? 'TREASURER_FLOAT').toUpperCase();
    const r = {
      id: `repl-${Date.now()}`,
      amount_php: body.amount_php,
      note: body.note ?? null,
      source,
      added_at: new Date().toISOString(),
    };
    shift.replenishments = [...(shift.replenishments ?? []), r];
    shift.total_replenishment_php = (shift.total_replenishment_php ?? 0) + body.amount_php;
    // Replenish handler returns the shift; route the response through withTreasurerView
    // so the bale_peso_php aggregate stays current after each SAFE pull.
    if (source === 'SAFE') {
      SAFE_MOVEMENTS.push({
        id: `sm-${Date.now()}`,
        amount_php: -Math.abs(body.amount_php),
        reason: 'REPLENISH_DRAWER',
        note: body.note ?? null,
        actor_username: cashier,
        related_replenishment_id: r.id,
        related_dispatch_id: null,
        movement_date: today,
        created_at: new Date().toISOString(),
      });
    }
    return json(res, withTreasurerView(shift));
  }

  // ── Safe / Vault ─────────────────────────────────────────────────────────
  if (method === 'GET' && url.startsWith('/api/v1/safe') && !url.startsWith('/api/v1/safe/movements')) {
    const todays = SAFE_MOVEMENTS.filter(m => m.movement_date === today);
    const today_net   = Math.round(todays.reduce((s, m) => s + m.amount_php, 0) * 100) / 100;
    const running_net = Math.round(SAFE_MOVEMENTS.reduce((s, m) => s + m.amount_php, 0) * 100) / 100;
    return json(res, { date: today, today_net, running_net, movements: todays });
  }
  if (method === 'POST' && url === '/api/v1/safe/movements') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const body    = JSON.parse(await readBody(req));
    const m = {
      id: `sm-${Date.now()}`,
      amount_php: body.amount_php,
      reason: (body.reason ?? 'OTHER').toUpperCase(),
      note: body.note ?? null,
      actor_username: payload.sub ?? 'admin',
      related_replenishment_id: null,
      related_dispatch_id: null,
      movement_date: today,
      created_at: new Date().toISOString(),
    };
    SAFE_MOVEMENTS.push(m);
    return json(res, m, 201);
  }

  // ── PHP Capital ──────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/v1/capital/php') {
    const running_total = Math.round(CAPITAL_ENTRIES.reduce((s, e) => s + e.amount_php, 0) * 100) / 100;
    const sorted = [...CAPITAL_ENTRIES].sort((a, b) =>
      a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 :
      a.created_at < b.created_at ? 1 : -1
    );
    return json(res, { running_total, entries: sorted });
  }
  if (method === 'POST' && url === '/api/v1/capital/php') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const body    = JSON.parse(await readBody(req));
    if (!body.amount_php) return json(res, { detail: 'Amount cannot be zero.' }, 400);
    const entry = {
      id: `cap-${Date.now()}`,
      amount_php: body.amount_php,
      note: body.note ?? null,
      entry_date: body.entry_date ?? today,
      created_by: payload.sub ?? 'admin',
      created_at: new Date().toISOString(),
    };
    CAPITAL_ENTRIES.push(entry);
    return json(res, entry, 201);
  }
  // PATCH /api/v1/capital/php/{id}
  {
    const m = url.match(/^\/api\/v1\/capital\/php\/([^/?]+)$/);
    if (m && method === 'PATCH') {
      const idx = CAPITAL_ENTRIES.findIndex(e => e.id === m[1]);
      if (idx < 0) return json(res, { detail: 'Entry not found.' }, 404);
      const body = JSON.parse(await readBody(req));
      if (!body.amount_php) return json(res, { detail: 'Amount cannot be zero.' }, 400);
      CAPITAL_ENTRIES[idx] = { ...CAPITAL_ENTRIES[idx], amount_php: body.amount_php, note: body.note ?? null, entry_date: body.entry_date ?? CAPITAL_ENTRIES[idx].entry_date };
      return json(res, CAPITAL_ENTRIES[idx]);
    }
    if (m && method === 'DELETE') {
      const idx = CAPITAL_ENTRIES.findIndex(e => e.id === m[1]);
      if (idx < 0) return json(res, { detail: 'Entry not found.' }, 404);
      CAPITAL_ENTRIES.splice(idx, 1);
      res.statusCode = 204; return res.end();
    }
  }

  // ── Branch Capital ────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/v1/capital/branches') {
    const total_php = Math.round(BRANCH_CAPITAL.reduce((s, r) => s + r.amount_php, 0) * 100) / 100;
    return json(res, { total_php, rows: [...BRANCH_CAPITAL].sort((a, b) => a.branch_code.localeCompare(b.branch_code)) });
  }
  {
    const m = url.match(/^\/api\/v1\/capital\/branches\/([^/]+)$/);
    if (m) {
      const code = decodeURIComponent(m[1]);
      const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
      const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
      if (method === 'PUT') {
        const body = JSON.parse(await readBody(req));
        const now = new Date().toISOString();
        const existing = BRANCH_CAPITAL.find(r => r.branch_code === code);
        if (existing) {
          existing.amount_php = body.amount_php;
          existing.updated_by = payload.sub ?? 'admin';
          existing.updated_at = now;
          return json(res, existing);
        }
        const fresh = { branch_code: code, amount_php: body.amount_php, updated_by: payload.sub ?? 'admin', updated_at: now };
        BRANCH_CAPITAL.push(fresh);
        return json(res, fresh);
      }
      if (method === 'DELETE') {
        const idx = BRANCH_CAPITAL.findIndex(r => r.branch_code === code);
        if (idx === -1) return json(res, { detail: 'Branch capital row not found.' }, 404);
        BRANCH_CAPITAL.splice(idx, 1);
        res.statusCode = 204; return res.end();
      }
    }
  }

  // ── Peso Ken ledger ───────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/v1/capital/peso-ken') {
    const running_total = Math.round(PESO_KEN_ENTRIES.reduce((s, e) => s + e.amount_php, 0) * 100) / 100;
    const sorted = [...PESO_KEN_ENTRIES].sort((a, b) =>
      a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 :
      a.created_at < b.created_at ? 1 : -1
    );
    return json(res, { running_total, entries: sorted });
  }
  if (method === 'POST' && url === '/api/v1/capital/peso-ken') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const body    = JSON.parse(await readBody(req));
    if (!body.amount_php) return json(res, { detail: 'Amount cannot be zero.' }, 400);
    const entry = {
      id: `pk-${Date.now()}`,
      amount_php: body.amount_php,
      note: body.note ?? null,
      entry_date: body.entry_date ?? today,
      created_by: payload.sub ?? 'admin',
      created_at: new Date().toISOString(),
    };
    PESO_KEN_ENTRIES.push(entry);
    return json(res, entry, 201);
  }
  // PATCH /api/v1/capital/peso-ken/{id}
  {
    const m = url.match(/^\/api\/v1\/capital\/peso-ken\/([^/?]+)$/);
    if (m && method === 'PATCH') {
      const idx = PESO_KEN_ENTRIES.findIndex(e => e.id === m[1]);
      if (idx < 0) return json(res, { detail: 'Entry not found.' }, 404);
      const body = JSON.parse(await readBody(req));
      if (!body.amount_php) return json(res, { detail: 'Amount cannot be zero.' }, 400);
      PESO_KEN_ENTRIES[idx] = { ...PESO_KEN_ENTRIES[idx], amount_php: body.amount_php, note: body.note ?? null, entry_date: body.entry_date ?? PESO_KEN_ENTRIES[idx].entry_date };
      return json(res, PESO_KEN_ENTRIES[idx]);
    }
    if (m && method === 'DELETE') {
      const idx = PESO_KEN_ENTRIES.findIndex(e => e.id === m[1]);
      if (idx < 0) return json(res, { detail: 'Entry not found.' }, 404);
      PESO_KEN_ENTRIES.splice(idx, 1);
      res.statusCode = 204; return res.end();
    }
  }

  // ── Misc ledger ──────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/v1/capital/misc') {
    const running_total = Math.round(MISC_ENTRIES.reduce((s, e) => s + e.amount_php, 0) * 100) / 100;
    const sorted = [...MISC_ENTRIES].sort((a, b) =>
      a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 :
      a.created_at < b.created_at ? 1 : -1
    );
    return json(res, { running_total, entries: sorted });
  }
  if (method === 'POST' && url === '/api/v1/capital/misc') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const body    = JSON.parse(await readBody(req));
    if (!body.amount_php) return json(res, { detail: 'Amount cannot be zero.' }, 400);
    const entry = {
      id: `misc-${Date.now()}`,
      amount_php: body.amount_php,
      note: body.note ?? null,
      entry_date: body.entry_date ?? today,
      created_by: payload.sub ?? 'admin',
      created_at: new Date().toISOString(),
    };
    MISC_ENTRIES.push(entry);
    return json(res, entry, 201);
  }
  {
    const m = url.match(/^\/api\/v1\/capital\/misc\/([^/?]+)$/);
    if (m && method === 'PATCH') {
      const idx = MISC_ENTRIES.findIndex(e => e.id === m[1]);
      if (idx < 0) return json(res, { detail: 'Entry not found.' }, 404);
      const body = JSON.parse(await readBody(req));
      if (!body.amount_php) return json(res, { detail: 'Amount cannot be zero.' }, 400);
      MISC_ENTRIES[idx] = { ...MISC_ENTRIES[idx], amount_php: body.amount_php, note: body.note ?? null, entry_date: body.entry_date ?? MISC_ENTRIES[idx].entry_date };
      return json(res, MISC_ENTRIES[idx]);
    }
    if (m && method === 'DELETE') {
      const idx = MISC_ENTRIES.findIndex(e => e.id === m[1]);
      if (idx < 0) return json(res, { detail: 'Entry not found.' }, 404);
      MISC_ENTRIES.splice(idx, 1);
      res.statusCode = 204; return res.end();
    }
  }

  // ── Peso Merly (treasurer1 + treasurer2 expected drawer cash) ────────────
  if (method === 'GET' && url.startsWith('/api/v1/capital/peso-merly')) {
    return json(res, { date: today, total_php: 0, lines: [] });
  }

  // ── Reconciliation (composes all 6 components) ───────────────────────────
  if (method === 'GET' && url.startsWith('/api/v1/capital/reconciliation')) {
    return json(res, {
      date: today,
      capital_php: 0, stocks_php: 0, payables_php: 0, branches_php: 0,
      peso_ken_php: 0, misc_php: 0, peso_merly_php: 0, available_php: 0, investor_php: 0,
    });
  }

  // ── Investors ─────────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/v1/investors') {
    return json(res, INVESTORS);
  }
  if (method === 'POST' && url === '/api/v1/investors') {
    const auth    = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    const payload = auth ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString()) : {};
    const body    = JSON.parse(await readBody(req));
    if (!body.name || !body.name.trim())  return json(res, { detail: 'Name cannot be blank.' }, 400);
    if (!body.capital_php || body.capital_php <= 0) return json(res, { detail: 'Capital must be positive.' }, 400);
    if (body.monthly_rate_pct < 0)        return json(res, { detail: 'Rate cannot be negative.' }, 400);
    const inv = {
      id: `inv-${Date.now()}`,
      name: body.name.trim(),
      capital_php: body.capital_php,
      monthly_rate_pct: body.monthly_rate_pct,
      note: body.note ?? null,
      created_by: payload.sub ?? 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    INVESTORS.push(inv);
    return json(res, inv, 201);
  }
  {
    const m = url.match(/^\/api\/v1\/investors\/([^/]+)$/);
    if (m) {
      const id = m[1];
      const idx = INVESTORS.findIndex(i => i.id === id);
      if (idx < 0) return json(res, { detail: 'Investor not found.' }, 404);
      if (method === 'PATCH') {
        const body = JSON.parse(await readBody(req));
        const inv = INVESTORS[idx];
        if (body.name !== undefined)             inv.name = body.name.trim();
        if (body.capital_php !== undefined)      inv.capital_php = body.capital_php;
        if (body.monthly_rate_pct !== undefined) inv.monthly_rate_pct = body.monthly_rate_pct;
        if (body.note !== undefined)             inv.note = body.note?.trim() || null;
        inv.updated_at = new Date().toISOString();
        return json(res, inv);
      }
      if (method === 'DELETE') {
        INVESTORS.splice(idx, 1);
        res.statusCode = 204; res.end(); return;
      }
    }
  }

  // ── Date override (test mode) ────────────────────────────────────────────
  if (method === 'GET' && url === '/api/v1/config/today') {
    const t = mockTestDate ?? new Date().toISOString().slice(0, 10);
    return json(res, { today: t });
  }
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
  // NOTE: mockTestDate is intentionally NOT reset here — only date-override tests
  // set it, and they manage cleanup via afterEach DELETE to avoid cross-worker races.
  if (method === 'POST' && url === '/api/v1/test/reset') {
    EDIT_REQUESTS.length = 0;
    CREDITS = makeInitialCredits();
    LEDGER = { 'credit-001': [] };
    CUSTOMERS = makeInitialCustomers();
    CAPITAL_ENTRIES.length = 0;
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
