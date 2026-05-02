import { NextRequest, NextResponse } from 'next/server';
import { getTokenRole } from '@/lib/api';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function token() {
  const c = await cookies();
  return c.get(AUTH_COOKIE)?.value;
}

export async function GET(req: NextRequest) {
  const role = await getTokenRole();
  if (role !== 'admin' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const date = req.nextUrl.searchParams.get('date');
  const qs = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${API_URL}/api/v1/safe${qs}`, {
    headers: { Authorization: `Bearer ${await token()}` },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const role = await getTokenRole();
  if (role !== 'admin' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const res = await fetch(`${API_URL}/api/v1/safe/movements`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
