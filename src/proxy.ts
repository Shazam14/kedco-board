import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = process.env.AUTH_COOKIE ?? 'kedco_token';
const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  const token = req.cookies.get(AUTH_COOKIE)?.value;

  if (!isPublic && !token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
