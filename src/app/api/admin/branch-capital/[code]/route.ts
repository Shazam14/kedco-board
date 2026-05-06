import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getToken() {
  return (await cookies()).get(AUTH_COOKIE)?.value;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { code } = await ctx.params;
  const body = await req.json();
  const res = await fetch(`${API_URL}/api/v1/capital/branches/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { code } = await ctx.params;
  const res = await fetch(`${API_URL}/api/v1/capital/branches/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
}
