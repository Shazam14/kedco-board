import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL    = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getToken() {
  return (await cookies()).get(AUTH_COOKIE)?.value ?? null;
}

// GET /api/admin/audit?table=&action=&user=&limit=100
export async function GET(req: NextRequest) {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const upstream = `${API_URL}/api/v1/audit/log${qs ? `?${qs}` : ''}`;

  const res = await fetch(upstream, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json([], { status: res.status });
  return NextResponse.json(await res.json());
}
