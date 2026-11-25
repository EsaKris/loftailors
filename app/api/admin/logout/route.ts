import { NextResponse } from 'next/server';
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303);
  res.cookies.set('sb-at', '', { path: '/', maxAge: 0 });
  res.cookies.set('sb-rt', '', { path: '/', maxAge: 0 });
  return res;
}
