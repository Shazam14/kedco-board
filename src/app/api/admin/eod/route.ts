import { NextResponse } from 'next/server';
import { getTokenRole } from '@/lib/api';
import { cookies } from 'next/headers';

const API_URL    = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function POST() {
  const role = await getTokenRole();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  const res = await fetch(`${API_URL}/api/v1/eod/close`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
