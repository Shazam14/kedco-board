export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import FloatsShell from '@/app/_components/FloatsShell';

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

export default async function SupervisorFloatsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');
  const payload = decodeToken(token);
  if (!payload || !['admin', 'supervisor'].includes(payload.role)) redirect('/login');

  const cashierFloats = await fetchJson(`${API_URL}/api/v1/treasurer/cashiers`, token, []);
  const username = payload.full_name || payload.sub;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <FloatsShell
      cashierFloats={cashierFloats as any[]}
      username={username}
    />
  );
}
