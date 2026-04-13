import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RiderShell from '@/app/_components/RiderShell';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(token: string) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

async function getCurrencies(token: string) {
  try {
    const res = await fetch(`${API_URL}/api/v1/currencies/meta`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    return res.ok ? res.json() : [];
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
