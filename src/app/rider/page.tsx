export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RiderShell from '@/app/_components/RiderShell';
import type { CurrencyMeta } from '@/lib/types';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(token: string) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

async function getCurrencies(token: string): Promise<CurrencyMeta[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/currencies/`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw = await res.json() as Record<string, unknown>[];
    // Convert snake_case API response to camelCase for the client component
    return raw.map(c => ({
      code:           c.code           as string,
      name:           c.name           as string,
      flag:           c.flag           as string,
      category:       c.category       as string,
      decimalPlaces:  (c.decimal_places  ?? c.decimalPlaces)  as number,
      todayBuyRate:   (c.today_buy_rate  ?? c.todayBuyRate)   as number | null,
      todaySellRate:  (c.today_sell_rate ?? c.todaySellRate)  as number | null,
      rateSet:        (c.rate_set        ?? c.rateSet)        as boolean,
    }));
  } catch { return []; }
}

async function getBanks() {
  try {
    const res = await fetch(`${API_URL}/api/v1/banks`, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch { return []; }
}

export default async function RiderPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');

  const payload = decodeToken(token);
  if (!payload || payload.role !== 'rider') redirect('/login');

  const [currencies, banks] = await Promise.all([
    getCurrencies(token),
    getBanks(),
  ]);

  return <RiderShell currencies={currencies} banks={banks} username={payload.sub} />;
}
