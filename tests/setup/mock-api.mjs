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
  admin:        { role: 'admin',      full_name: 'Admin User' },
  supervisor1:  { role: 'supervisor', full_name: 'Supervisor One' },
  supervisor2:  { role: 'supervisor', full_name: 'Supervisor Two' },
  cashier1:     { role: 'cashier',    full_name: 'Cashier One' },
  cashier2:     { role: 'cashier',    full_name: 'Cashier Two' },
  rider01:      { role: 'rider',      full_name: 'Rider One' },
  rider02:      { role: 'rider',      full_name: 'Rider Two' },
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

const BANKS = [
  { id: 1, name: 'BDO',       code: 'BDO' },
  { id: 2, name: 'BPI',       code: 'BPI' },
  { id: 3, name: 'Metrobank', code: 'MBK' },
];

const ALL_USERS = Object.entries(USERS).map(([username, u]) => ({
  username, full_name: u.full_name, role: u.role, is_active: true,
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

  // Banks (rider page)
  if (method === 'GET' && url === '/api/v1/banks') return json(res, BANKS);

  // Users list (admin rider dispatch form)
  if (method === 'GET' && url === '/api/v1/users/') return json(res, ALL_USERS);

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

  // Transactions today (counter and rider)
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

  // Fallback
  console.warn(`[mock-api] Unhandled: ${method} ${url}`);
  json(res, { detail: 'Not found' }, 404);
});

server.listen(9999, () => {
  console.log('[mock-api] Running on http://localhost:9999');
});
