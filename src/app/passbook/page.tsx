import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import PassbookDepositShell from '@/app/_components/PassbookDepositShell';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(t: string) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

async function getBanks() {
  const res = await fetch(`${API_URL}/api/v1/banks`, { cache: 'no-store' });
  return res.ok ? res.json() : [];
}

async function getMyDeposits(token: string) {
  const res = await fetch(`${API_URL}/api/v1/passbook/my-deposits`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return res.ok ? res.json() : [];
}

export default async function PassbookPage() {
  const cookieStore = await cookies();
  const token       = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) redirect('/login');
  const payload = decodeToken(token);
  if (!payload) redirect('/login');

  const [banks, deposits] = await Promise.all([getBanks(), getMyDeposits(token)]);

  return (
    <PassbookDepositShell
      banks={banks}
      recentDeposits={deposits}
      username={payload.sub ?? payload.username ?? ''}
    />
  );
}
