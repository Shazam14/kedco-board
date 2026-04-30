export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TreasurerShell from '@/app/_components/TreasurerShell';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(t: string) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

async function fetchJson(url: string, token: string, fallback: unknown = []) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    return res.ok ? res.json() : fallback;
  } catch { return fallback; }
}

export default async function SupervisorOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');
  const payload = decodeToken(token);
  if (!payload || !['admin', 'supervisor'].includes(payload.role)) redirect('/login');

  const [dispatches, users, currencies, cashierFloats] = await Promise.all([
    fetchJson(`${API_URL}/api/v1/rider/dispatches/today`, token),
    fetchJson(`${API_URL}/api/v1/users`, token),
    fetchJson(`${API_URL}/api/v1/currencies`, token),
    fetchJson(`${API_URL}/api/v1/treasurer/cashiers`, token, []),
  ]);

  const riders = (users as { username: string; full_name: string; role: string }[])
    .filter(u => u.role === 'rider');

  const activeCurrencies = ['PHP', ...(currencies as { code: string }[]).map(c => c.code)];
  const username = payload.full_name || payload.sub;

  const { tab } = await searchParams;
  const initialTab = tab === 'cashiers' ? 'cashiers' : 'riders';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <TreasurerShell
      dispatches={dispatches as any[]}
      riders={riders}
      currencies={activeCurrencies}
      cashierFloats={cashierFloats as any[]}
      username={username}
      initialTab={initialTab}
    />
  );
}
