import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json([], { status: 401 });

  const res = await fetch(`${API_URL}/api/v1/transactions/today`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) return NextResponse.json([], { status: res.status });

  const raw: Record<string, unknown>[] = await res.json();

  // Map snake_case → camelCase so the client component gets clean types
  const mapped = raw.map(t => ({
    id:         t.id,
    time:       t.time,
    type:       t.type,
    source:     t.source,
    currency:   t.currency,
    foreignAmt: t.foreign_amt,
    rate:       t.rate,
    phpAmt:     t.php_amt,
    than:       t.than,
    cashier:     t.cashier,
    customer:    t.customer ?? undefined,
    paymentMode:  t.payment_mode ?? undefined,
    bankId:       t.bank_id != null ? Number(t.bank_id) : undefined,
    officialRate:   t.official_rate != null ? Number(t.official_rate) : undefined,
    referrer:       t.referrer ?? undefined,
    paymentTag:     t.payment_tag ?? undefined,
    referenceDate:  t.reference_date ?? undefined,
  }));

  return NextResponse.json(mapped);
}
