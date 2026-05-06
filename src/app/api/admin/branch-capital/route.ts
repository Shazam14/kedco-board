import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getToken() {
  return (await cookies()).get(AUTH_COOKIE)?.value;
}

export async function GET() {
  const token = await getToken();
  if (!token) return NextResponse.json({ total_php: 0, rows: [] }, { status: 401 });
  const res = await fetch(`${API_URL}/api/v1/capital/branches`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
