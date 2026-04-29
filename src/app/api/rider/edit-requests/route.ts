import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL    = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json([], { status: 401 });

  const res = await fetch(`${API_URL}/api/v1/transactions/my-pending-edits`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json([]);
  return NextResponse.json(await res.json());
}
