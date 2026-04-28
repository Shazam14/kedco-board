import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json(null);
  const res = await fetch(`${API_URL}/api/v1/treasurer/pending-float`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return NextResponse.json(res.ok ? await res.json() : null);
}
