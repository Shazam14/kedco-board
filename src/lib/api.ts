// Server-side only — never imported by client components.
// Reads the auth cookie and calls the FastAPI backend.
// The token and API URL never reach the browser.

import { cookies } from 'next/headers';
import type { DashboardSummary, CurrencyPosition, Transaction, CurrencyMeta } from './types';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function apiFetch<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', // always fresh — this is a live dashboard
  });

  if (!res.ok) return null;
  return res.json();
}

// Map snake_case API response → camelCase TypeScript types
function mapPosition(p: Record<string, unknown>): CurrencyPosition {
  return {
    code: p.code as string,
    name: p.name as string,
    flag: p.flag as string,
    category: p.category as CurrencyPosition['category'],
    decimalPlaces: p.decimal_places as number,
    totalQty: p.total_qty as number,
    dailyAvgCost: p.daily_avg_cost as number,
    todayBuyRate: p.today_buy_rate as number,
    todaySellRate: p.today_sell_rate as number,
    stockValuePhp: p.stock_value_php as number,
    todayGainPerUnit: p.today_gain_per_unit as number,
    unrealizedPHP: p.unrealized_php as number,
  };
}

function mapTransaction(t: Record<string, unknown>): Transaction {
  return {
    id: t.id as string,
    time: t.time as string,
    type: t.type as Transaction['type'],
    source: t.source as Transaction['source'],
    currency: t.currency as string,
    foreignAmt: t.foreign_amt as number,
    rate: t.rate as number,
    phpAmt: t.php_amt as number,
    than: t.than as number,
    cashier: t.cashier as string,
    customer: t.customer as string | undefined,
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  const raw = await apiFetch<Record<string, unknown>>('/api/v1/dashboard/summary');
  if (!raw) return null;

  return {
    date: raw.date as string,
    openingCapital: raw.opening_capital as number,
    phpCash: raw.php_cash as number,
    totalStockValue: raw.total_stock_value as number,
    totalCapital: raw.total_capital as number,
    totalUnrealized: raw.total_unrealized as number,
    totalThanToday: raw.total_than_today as number,
    totalBoughtToday: raw.total_bought_today as number,
    totalSoldToday: raw.total_sold_today as number,
    positions: (raw.positions as Record<string, unknown>[]).map(mapPosition),
    recentTransactions: (raw.recent_transactions as Record<string, unknown>[]).map(mapTransaction),
  };
}

export async function getTokenRole(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export async function getCurrencies(): Promise<CurrencyMeta[]> {
  const raw = await apiFetch<Record<string, unknown>[]>('/api/v1/currencies/');
  if (!raw) return [];
  return raw.map(c => ({
    code:          c.code as string,
    name:          c.name as string,
    flag:          c.flag as string,
    category:      c.category as string,
    decimalPlaces: c.decimal_places as number,
    todayBuyRate:  c.today_buy_rate  as number | null,
    todaySellRate: c.today_sell_rate as number | null,
    rateSet:       c.rate_set as boolean,
  }));
}

export interface PositionMeta {
  code:         string;
  name:         string;
  flag:         string;
  category:     string;
  decimalPlaces: number;
  carryInQty:   number;
  carryInRate:  number;
  positionSet:  boolean;
}

export async function getPositions(): Promise<PositionMeta[]> {
  const raw = await apiFetch<Record<string, unknown>[]>('/api/v1/positions/today');
  if (!raw) return [];
  return raw.map(p => ({
    code:         p.code          as string,
    name:         p.name          as string,
    flag:         p.flag          as string,
    category:     p.category      as string,
    decimalPlaces: p.decimal_places as number,
    carryInQty:   p.carry_in_qty  as number,
    carryInRate:  p.carry_in_rate as number,
    positionSet:  p.position_set  as boolean,
  }));
}

export async function saveRates(
  rates: { code: string; buy_rate: number; sell_rate: number }[]
): Promise<{ ok: boolean; message?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return { ok: false };

  const res = await fetch(`${API_URL}/api/v1/rates/today`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rates),
  });
  const data = await res.json();
  return { ok: res.ok, message: data.message ?? data.detail };
}

export async function loginToApi(
  username: string,
  password: string,
): Promise<{ token: string; role: string; fullName: string } | null> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    token: data.access_token,
    role: data.role,
    fullName: data.full_name,
  };
}
