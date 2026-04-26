import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value ?? null;
  if (!token) return NextResponse.json({ ratesSet: false, positionsSet: false }, { status: 401 });

  const [curRes, posRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/currencies/`,     { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
    fetch(`${API_URL}/api/v1/positions/today`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }),
  ]);

  const currencies = curRes.ok ? await curRes.json() : [];
  const positions  = posRes.ok ? await posRes.json() : [];

  return NextResponse.json({
    ratesSet:     Array.isArray(currencies) && currencies.some((c: { rate_set?: boolean }) => c.rate_set),
    positionsSet: Array.isArray(positions)  && positions.some((p: { position_set?: boolean }) => p.position_set),
  });
}
