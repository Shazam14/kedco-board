import { redirect } from 'next/navigation';
import { getCurrencies, getTokenRole, getTokenUsername } from '@/lib/api';
import CounterShell from '@/app/_components/CounterShell';

export default async function CounterPage() {
  const [role, username] = await Promise.all([getTokenRole(), getTokenUsername()]);

  if (!role || !['admin', 'cashier', 'supervisor'].includes(role)) {
    redirect('/login');
  }

  const currencies = await getCurrencies();

  return <CounterShell currencies={currencies} username={username ?? 'cashier'} />;
}
