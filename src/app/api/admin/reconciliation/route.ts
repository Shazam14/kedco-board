import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = req.nextUrl.searchParams.get('date');
  const url  = `${API_URL}/api/v1/capital/reconciliation${date ? `?date=${date}` : ''}`;
  const res  = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
