import { NextResponse } from 'next/server';
import { getTokenRole } from '@/lib/api';
import { cookies } from 'next/headers';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value;
}

export async function GET() {
  const role = await getTokenRole();
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const token = await getToken();
  const res = await fetch(`${API_URL}/api/v1/users/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
