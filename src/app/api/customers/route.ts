import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json([]);

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const limit = url.searchParams.get('limit') ?? '20';

  const upstream = new URL(`${API_URL}/api/v1/customers`);
  if (q) upstream.searchParams.set('q', q);
  upstream.searchParams.set('limit', limit);

  const res = await fetch(upstream.toString(), {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json([]);
  return NextResponse.json(await res.json());
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const res = await fetch(`${API_URL}/api/v1/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
