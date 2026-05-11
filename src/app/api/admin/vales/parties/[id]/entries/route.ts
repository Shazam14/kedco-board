import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

async function getToken() {
  return (await cookies()).get(AUTH_COOKIE)?.value;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const token = await getToken();
  if (!token) return NextResponse.json([], { status: 401 });
  const { id } = await ctx.params;
  const res = await fetch(`${API_URL}/api/v1/vales/parties/${id}/entries`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
