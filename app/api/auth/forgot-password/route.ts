import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { limited, ipOf } from '@/lib/ratelimit';

export async function POST(req: Request) {
  if (limited('forgot-password:' + ipOf(req), 5, 15 * 60_000)) return NextResponse.json({ error: 'Too many requests. Please wait before trying again.' }, { status: 429 });
  let email = '';
  try { const body = await req.json(); email = String(body.email || '').trim().toLowerCase().slice(0, 160); }
  catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 500 });
  let redirectTo: string;
  try {
    const configured = process.env.SITE_URL;
    const origin = configured ? new URL(configured).origin : new URL(req.url).origin;
    if (process.env.NODE_ENV === 'production' && (!configured || !origin.startsWith('https://'))) throw new Error('SITE_URL must be the production HTTPS domain.');
    redirectTo = new URL('/reset-password', origin).toString();
  } catch { return NextResponse.json({ error: 'The production site URL is not configured correctly.' }, { status: 500 }); }
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) console.error('Password recovery email request failed:', error.message);
  return NextResponse.json({ message: 'If an account exists for that email, a recovery link has been sent.' });
}
