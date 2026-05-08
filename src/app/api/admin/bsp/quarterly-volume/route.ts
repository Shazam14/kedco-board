import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokenRole } from '@/lib/api';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET(req: NextRequest) {
  const role = await getTokenRole();
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const qs    = req.nextUrl.searchParams.toString();

  const res = await fetch(`${API_URL}/api/v1/bsp/quarterly-volume${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache:   'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
