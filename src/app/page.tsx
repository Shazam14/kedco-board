import { redirect } from 'next/navigation';
import { getDashboardSummary } from '@/lib/api';
import DashboardShell from './_components/DashboardShell';

export default async function Home() {
  const data = await getDashboardSummary();

  // If token is missing or expired, middleware already redirects to /login.
  // This is a fallback in case the API call itself fails.
  if (!data) redirect('/login');

  return <DashboardShell data={data} />;
}
