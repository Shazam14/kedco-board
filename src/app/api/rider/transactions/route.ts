import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(token: string) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json([]);

  const payload = decodeToken(token);
  if (!payload || payload.role !== 'rider') return NextResponse.json([]);

  const res = await fetch(`${API_URL}/api/v1/transactions/today`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json([]);

  const raw: Record<string, unknown>[] = await res.json();

  // Only return this rider's transactions
  const mapped = raw
    .filter(t => t.source === 'RIDER' && t.cashier === payload.sub)
    .map(t => ({
      id: t.id, time: t.time, type: t.type, source: t.source,
      currency: t.currency, foreignAmt: t.foreign_amt,
      rate: t.rate, phpAmt: t.php_amt, than: t.than,
      cashier: t.cashier, customer: t.customer ?? undefined,
      paymentMode: t.payment_mode, bankId: t.bank_id,
    }));

  return NextResponse.json(mapped);
}
