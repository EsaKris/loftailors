import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settlePayment } from '@/lib/settle';
import { notify } from '@/lib/notify';
import { retryBackups } from '@/lib/sheets';
export const dynamic = 'force-dynamic';
// Recovers missed/delayed webhooks: re-checks payments still pending with Paystack; marks ones untouched for 24h as abandoned.
// Vercel calls this on the schedule in vercel.json with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse('Unauthorised', { status: 401 });
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString(), day = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: pend } = await db.from('payments').select('id, reference, order_id, created_at').eq('status', 'pending').eq('provider', 'paystack').lt('created_at', cutoff).limit(100);
  let recovered = 0, abandoned = 0;
  for (const p of pend || []) {
    try {
      const r = await settlePayment(p.reference);
      if (r.ok) recovered++;
      else if (r.status === 'pending' && p.created_at < day) {
        await db.from('payments').update({ status: 'abandoned' }).eq('id', p.id).eq('status', 'pending');
        await db.from('orders').update({ payment_status: 'abandoned', updated_at: new Date().toISOString() }).eq('id', p.order_id).eq('payment_status', 'pending');
        abandoned++;
      }
    } catch (e) { console.error('reconcile', p.reference, e); }
  }
  if (abandoned) await notify('payment', `${abandoned} abandoned card checkout(s)`, undefined, '/admin/orders?status=payment_pending', `abandon:${new Date().toISOString().slice(0, 10)}`);
  const backups = await retryBackups().catch(() => 0);
  return NextResponse.json({ checked: pend?.length ?? 0, recovered, abandoned, backupsRetried: backups });
}
