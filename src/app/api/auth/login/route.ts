import { NextRequest, NextResponse } from 'next/server';
import { loginToApi } from '@/lib/api';

const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';
const IS_PROD = process.env.NODE_ENV === 'production';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const result = await loginToApi(username, password);
  if (!result) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }

  const res = NextResponse.json({ role: result.role, fullName: result.fullName });

  // Store token in HTTP-only cookie — JS cannot read this
  res.cookies.set(AUTH_COOKIE, result.token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours — matches ACCESS_TOKEN_EXPIRE_MINUTES
  });

  return res;
}
