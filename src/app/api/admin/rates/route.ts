import { NextRequest, NextResponse } from 'next/server';
import { saveRates, getTokenRole } from '@/lib/api';

export async function POST(req: NextRequest) {
  const role = await getTokenRole();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const result = await saveRates(body);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
