import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';
import CapitalShell from '@/app/_components/CapitalShell';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getCapital(token: string) {
  const res = await fetch(`${API_URL}/api/v1/capital/php`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return res.ok ? res.json() : { running_total: 0, entries: [] };
}

export default async function CapitalPage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin') redirect('/');

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value!;
  const ledger = await getCapital(token);
  return <CapitalShell initial={ledger} />;
}
