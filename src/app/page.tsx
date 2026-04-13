import { redirect } from 'next/navigation';
import { getDashboardSummary, getTokenRole } from '@/lib/api';
import DashboardShell from './_components/DashboardShell';

export default async function Home() {
  const [data, role] = await Promise.all([getDashboardSummary(), getTokenRole()]);

  // If token is missing or expired, middleware already redirects to /login.
  // This is a fallback in case the API call itself fails.
  if (!data) redirect('/login');

  return <DashboardShell data={data} role={role ?? 'cashier'} />;
}
