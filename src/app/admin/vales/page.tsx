import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';
import ValesShell from '@/app/_components/ValesShell';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getBalances(token: string) {
  const res = await fetch(`${API_URL}/api/v1/vales/balances`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return res.ok ? res.json() : [];
}

export default async function ValesPage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin' && role !== 'supervisor') redirect('/');

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value!;
  const balances = await getBalances(token);
  return <ValesShell initial={balances} role={role} />;
}
