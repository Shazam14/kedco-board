export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PayablesShell from '@/app/_components/PayablesShell';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(t: string) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

async function fetchReport(token: string, dateParam?: string) {
  const url = `${API_URL}/api/v1/report/daily${dateParam ? `?date=${dateParam}` : ''}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    return res.ok ? res.json() : { transactions: [] };
  } catch { return { transactions: [] }; }
}

export default async function SupervisorPayablesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');
  const payload = decodeToken(token);
  if (!payload || !['admin', 'supervisor'].includes(payload.role)) redirect('/login');

  const { date: dateParam } = await searchParams;
  const report = await fetchReport(token, dateParam);
  const username = payload.full_name || payload.sub;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <PayablesShell
      transactions={(report?.transactions ?? []) as any[]}
      selectedDate={dateParam ?? ''}
      username={username}
    />
  );
}
