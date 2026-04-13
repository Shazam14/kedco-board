import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET(req: NextRequest) {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json([]);
  const dispatch_id = req.nextUrl.searchParams.get('dispatch_id');
  if (!dispatch_id) return NextResponse.json([]);
  const res = await fetch(`${API_URL}/api/v1/rider/borrows/${dispatch_id}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return NextResponse.json(res.ok ? await res.json() : []);
}
