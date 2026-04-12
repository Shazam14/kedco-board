import { NextResponse } from 'next/server';

const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
