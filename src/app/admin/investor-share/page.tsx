import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';
import InvestorShareShell, { Investor } from '@/app/_components/InvestorShareShell';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getInvestors(token: string): Promise<Investor[]> {
  const res = await fetch(`${API_URL}/api/v1/investors`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return res.ok ? res.json() : [];
}

export default async function InvestorSharePage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin') redirect('/');

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value!;
  const investors = await getInvestors(token);
  return <InvestorShareShell initialInvestors={investors} />;
}
