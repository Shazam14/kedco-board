import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RidersAdminShell from '@/app/_components/RidersAdminShell';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(t: string) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

async function fetchJson(url: string, token: string) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch { return []; }
}

export default async function RidersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');
  const payload = decodeToken(token);
  if (!payload || !['admin', 'supervisor'].includes(payload.role)) redirect('/');

  const [dispatches, users] = await Promise.all([
    fetchJson(`${API_URL}/api/v1/rider/dispatches/today`, token),
    fetchJson(`${API_URL}/api/v1/users`, token),
  ]);

  const riders = (users as { username: string; full_name: string; role: string }[])
    .filter(u => u.role === 'rider');

  return <RidersAdminShell dispatches={dispatches} riders={riders} />;
}
