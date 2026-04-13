import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

function decodeToken(token: string) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()); }
  catch { return null; }
}

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json({ dispatch: null });
  const payload = decodeToken(token);
  if (!payload || payload.role !== 'rider') return NextResponse.json({ dispatch: null });

  const res = await fetch(`${API_URL}/api/v1/rider/my-dispatch`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return NextResponse.json(res.ok ? await res.json() : { dispatch: null });
}
