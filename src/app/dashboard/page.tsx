export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { getDashboardSummary, getTokenRole } from '@/lib/api';
import DashboardShell from '@/app/_components/DashboardShell';

export default async function DashboardPage() {
  const [data, role] = await Promise.all([getDashboardSummary(), getTokenRole()]);

  if (!role) redirect('/login');
  if (role === 'cashier' || role === 'supervisor') redirect('/counter');
  if (role === 'rider') redirect('/rider');
  if (role !== 'admin') redirect('/login');
  if (!data) redirect('/login');

  return <DashboardShell data={data} role={role} />;
}
