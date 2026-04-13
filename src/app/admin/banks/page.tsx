import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ManageBanksShell from '@/app/_components/ManageBanksShell';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(t: string) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

async function getBanks(token: string) {
  const res = await fetch(`${API_URL}/api/v1/admin/banks`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return res.ok ? res.json() : [];
}

export default async function BanksPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');
  const payload = decodeToken(token);
  if (!payload || payload.role !== 'admin') redirect('/');

  const banks = await getBanks(token);
  return <ManageBanksShell banks={banks} />;
}
