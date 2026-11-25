import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db';
import { limited, ipOf } from '@/lib/ratelimit';
export async function POST(req: Request) {
  if (limited('login:' + ipOf(req), 10, 10 * 60_000)) return new Response('Too many attempts. Try again in a few minutes.', { status: 429 });
  const f = await req.formData();
  const who = String(f.get('email') || '').trim().toLowerCase().slice(0, 160);
  if (limited('login-acct:' + who, 8, 15 * 60_000)) return new Response('Too many attempts. Try again in a few minutes.', { status: 429 });   // slows password guessing across many IPs
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email: who, password: String(f.get('password') || '').slice(0, 200) });
  const fail = NextResponse.redirect(new URL('/login?e=1', req.url), 303);
  if (error || !data.session) return fail;
  const { data: a } = await db.from('administrators').select('id').eq('id', data.user.id).maybeSingle();
  if (!a) return fail;
  const res = NextResponse.redirect(new URL('/admin', req.url), 303);
  res.cookies.set('sb-at', data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: data.session.expires_in });
  res.cookies.set('sb-rt', data.session.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}
