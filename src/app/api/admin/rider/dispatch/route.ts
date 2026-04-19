import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL!;
const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

// PATCH /api/admin/rider/dispatch  { dispatch_id, action: 'return' | 'confirm_payment', txn_id? }
export async function PATCH(req: NextRequest) {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dispatch_id, action, txn_id, items } = await req.json();

  let url = '';
  if (action === 'return')          url = `${API_URL}/api/v1/rider/dispatches/${dispatch_id}/return`;
  if (action === 'confirm_payment') url = `${API_URL}/api/v1/rider/transactions/${txn_id}/confirm-payment`;

  if (!url) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const body = action === 'return' ? JSON.stringify({ items: items ?? [] }) : undefined;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
