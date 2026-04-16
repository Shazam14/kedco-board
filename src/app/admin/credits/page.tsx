import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';
import { cookies } from 'next/headers';
import CreditShell from '@/app/_components/CreditShell';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getCredits() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return [];
  const res = await fetch(`${API_URL}/api/v1/credits/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function CreditsPage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin' && role !== 'supervisor') redirect('/');

  const credits = await getCredits();
  return <CreditShell credits={credits} />;
}
