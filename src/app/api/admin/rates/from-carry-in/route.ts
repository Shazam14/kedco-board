import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function POST() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value ?? null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${API_URL}/api/v1/rates/from-carry-in`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
