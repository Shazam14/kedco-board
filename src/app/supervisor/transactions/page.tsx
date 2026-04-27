export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { getCurrencies, getTokenRole, getTokenUsername } from '@/lib/api';
import SupervisorTxnsShell from '@/app/_components/SupervisorTxnsShell';

export default async function SupervisorTransactionsPage() {
  const [role, username] = await Promise.all([getTokenRole(), getTokenUsername()]);

  if (!role || !['admin', 'supervisor'].includes(role)) {
    redirect('/login');
  }

  const currencies = await getCurrencies();

  return <SupervisorTxnsShell currencies={currencies} username={username ?? ''} role={role} />;
}
