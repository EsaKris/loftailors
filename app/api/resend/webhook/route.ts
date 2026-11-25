import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
export const runtime = 'nodejs';
// Resend signs webhooks with Svix. Delivered / bounced / complained status shows up on Emails and each order.
function valid(raw: string, h: Headers, secret: string) {
  const id = h.get('svix-id'), ts = h.get('svix-timestamp'), sig = h.get('svix-signature');
  if (!id || !ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const exp = crypto.createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64')).update(`${id}.${ts}.${raw}`).digest('base64');
  return sig.split(' ').some(s => { const v = s.split(',')[1] || ''; return v.length === exp.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(exp)); });
}
const MAP: Record<string, string> = { 'email.delivered': 'delivered', 'email.bounced': 'bounced', 'email.complained': 'complained', 'email.delivery_delayed': 'delayed' };
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new NextResponse('not configured', { status: 404 });
  const raw = await req.text();
  if (!valid(raw, req.headers, secret)) return new NextResponse('invalid signature', { status: 401 });
  const evt = JSON.parse(raw), st = MAP[evt.type], id = evt.data?.email_id;
  if (st && id) {
    const q = db.from('email_log').update({ status: st }).eq('provider_id', id);
    await (st === 'delivered' ? q.in('status', ['sent', 'queued', 'delayed']) : q.not('status', 'in', '(bounced,complained)'));   // never downgrade a bounce
  }
  return NextResponse.json({ ok: true });
}
