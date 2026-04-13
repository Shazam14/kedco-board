import { redirect } from 'next/navigation';
import { getDashboardSummary, getTokenRole } from '@/lib/api';
import DashboardShell from '@/app/_components/DashboardShell';

export default async function DashboardPage() {
  const [data, role] = await Promise.all([getDashboardSummary(), getTokenRole()]);

  if (!role || !['admin', 'supervisor'].includes(role)) redirect('/');
  if (!data) redirect('/login');

  return <DashboardShell data={data} role={role} />;
}
