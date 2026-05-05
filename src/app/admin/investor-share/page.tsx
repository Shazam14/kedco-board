import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';
import InvestorShareShell from '@/app/_components/InvestorShareShell';

export default async function InvestorSharePage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin') redirect('/');
  return <InvestorShareShell />;
}
