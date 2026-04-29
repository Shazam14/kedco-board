import { NextResponse } from 'next/server';
import { getTokenRole } from '@/lib/api';
import { cookies } from 'next/headers';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value;
}

export async function GET(req: Request) {
  const role = await getTokenRole();
  if (role !== 'admin' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const token = await getToken();
  const url = new URL(req.url);

  const upstream = new URL(`${API_URL}/api/v1/admin/customers`);
  for (const k of ['q', 'limit', 'include_inactive']) {
    const v = url.searchParams.get(k);
    if (v !== null) upstream.searchParams.set(k, v);
  }

  const res = await fetch(upstream.toString(), {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json([]);
  return NextResponse.json(await res.json());
}
