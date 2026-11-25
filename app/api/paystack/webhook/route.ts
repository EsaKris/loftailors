import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { settlePayment } from '@/lib/settle';
import { markRefundFromWebhook } from '@/lib/refunds';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const raw = await req.text();                      // signature is computed over the exact raw body
  const sig = req.headers.get('x-paystack-signature') || '';
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '').update(raw).digest('hex');
  const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return new NextResponse('invalid signature', { status: 401 });

  const evt = JSON.parse(raw);
  const key = `${evt.event}:${evt.data?.id ?? evt.data?.reference}`;
  const { error: dup } = await db.from('webhook_events').insert({ provider: 'paystack', event_key: key, event_type: evt.event, payload: evt });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });   // already received

  try {
    if (evt.event === 'charge.success' && evt.data?.reference) await settlePayment(evt.data.reference);
    if (evt.event === 'refund.processed' && evt.data?.transaction_reference) await markRefundFromWebhook(evt.data.transaction_reference, evt.data.id ? String(evt.data.id) : undefined);
    await db.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('event_key', key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    await db.from('webhook_events').delete().eq('event_key', key);   // let Paystack retry
    return new NextResponse('error', { status: 500 });
  }
}
