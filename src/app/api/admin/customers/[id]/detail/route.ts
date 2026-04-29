import { NextResponse } from 'next/server';
import { getTokenRole } from '@/lib/api';
import { cookies } from 'next/headers';

const API_URL     = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = await getTokenRole();
  if (role !== 'admin' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const { id } = await params;

  const res = await fetch(`${API_URL}/api/v1/admin/customers/${id}/detail`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
