import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(token: string) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json([]);
  const payload = decodeToken(token);
  if (!payload || payload.role !== 'rider') return NextResponse.json([]);

  const dRes = await fetch(`${API_URL}/api/v1/rider/my-dispatch`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!dRes.ok) return NextResponse.json([]);
  const { dispatch } = await dRes.json();
  if (!dispatch?.id) return NextResponse.json([]);

  const res = await fetch(`${API_URL}/api/v1/rider/borrows/${dispatch.id}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return NextResponse.json(res.ok ? await res.json() : []);
}

export async function POST(req: NextRequest) {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = decodeToken(token);
  if (!payload || payload.role !== 'rider') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const res = await fetch(`${API_URL}/api/v1/rider/borrows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
