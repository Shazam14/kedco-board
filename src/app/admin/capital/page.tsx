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

async function getBranchCapital(token: string) {
  const res = await fetch(`${API_URL}/api/v1/capital/branches`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return res.ok ? res.json() : { total_php: 0, rows: [] };
}

async function getPesoKen(token: string) {
  const res = await fetch(`${API_URL}/api/v1/capital/peso-ken`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return res.ok ? res.json() : { running_total: 0, entries: [] };
}

async function getToday(token: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/config/today`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (res.ok) {
    const data = await res.json();
    if (data.today) return data.today;
  }
  return new Date().toISOString().slice(0, 10);
}

export default async function CapitalPage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin') redirect('/');

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value!;
  const [ledger, today, branchInitial, pesoKenInitial] = await Promise.all([
    getCapital(token), getToday(token), getBranchCapital(token), getPesoKen(token),
  ]);
  return <CapitalShell initial={ledger} today={today} branchInitial={branchInitial} pesoKenInitial={pesoKenInitial} />;
}
