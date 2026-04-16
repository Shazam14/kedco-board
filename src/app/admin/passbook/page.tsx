import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import PassbookShell from '@/app/_components/PassbookShell';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(t: string) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

async function getPassbook(token: string) {
  const res = await fetch(`${API_URL}/api/v1/passbook/`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return res.ok ? res.json() : [];
}

export default async function PassbookPage() {
  const cookieStore = await cookies();
  const token       = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');
  const payload = decodeToken(token);
  if (!payload || (payload.role !== 'admin' && payload.role !== 'supervisor')) redirect('/');

  const data = await getPassbook(token);
  return <PassbookShell data={data} />;
}
