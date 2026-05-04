import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTokenRole } from '@/lib/api';
import ReportShell from '@/app/_components/ReportShell';

const API_URL    = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function fetchReport(dateParam?: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const url = `${API_URL}/api/v1/report/daily${dateParam ? `?date=${dateParam}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchCapitalTotal(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const res = await fetch(`${API_URL}/api/v1/capital/php`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.running_total === 'number' ? data.running_total : null;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (!['admin', 'supervisor'].includes(role)) redirect('/');

  const { date: dateParam } = await searchParams;
  const report = await fetchReport(dateParam);
  const phpCapital = role === 'admin' ? await fetchCapitalTotal() : null;

  return <ReportShell report={report} selectedDate={dateParam ?? ''} hideThan={role !== 'admin'} role={role} phpCapital={phpCapital} />;
}
