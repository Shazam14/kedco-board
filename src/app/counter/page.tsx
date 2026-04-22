export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { getCurrencies, getTokenRole, getTokenUsername } from '@/lib/api';
import CounterShell from '@/app/_components/CounterShell';

const API_URL = process.env.API_URL!;

async function getBanks() {
  try {
    const res = await fetch(`${API_URL}/api/v1/banks`, { cache: 'no-store' });
    return res.ok ? res.json() : [];
  } catch { return []; }
}

export default async function CounterPage() {
  const [role, username] = await Promise.all([getTokenRole(), getTokenUsername()]);

  if (!role || !['admin', 'cashier', 'supervisor'].includes(role)) {
    redirect('/login');
  }

  const [currencies, banks] = await Promise.all([getCurrencies(), getBanks()]);
  const branchLocation = process.env.BRANCH_LOCATION ?? 'Lapu-Lapu City';

  return <CounterShell currencies={currencies} banks={banks} username={username ?? 'cashier'} role={role} branchLocation={branchLocation} />;
}
