import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL    = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json([], { status: 401 });

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const upstream = `${API_URL}/api/v1/admin/edit-requests${qs ? `?${qs}` : ''}`;
  const res = await fetch(upstream, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json([], { status: res.status });
  return NextResponse.json(await res.json());
}
