import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

// GET /api/admin/riders — list all riders (for dispatch form)
export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json([], { status: 401 });

  const res = await fetch(`${API_URL}/api/v1/users/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json([]);

  const users: { username: string; full_name: string; role: string }[] = await res.json();
  return NextResponse.json(users.filter(u => u.role === 'rider'));
}
