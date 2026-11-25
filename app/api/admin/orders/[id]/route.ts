import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin, can } from '@/lib/auth';
import { logActivity } from '@/lib/notify';
import { backupOrder } from '@/lib/sheets';
import { getSetting } from '@/lib/settings';
import { sendOrderEmail, STATUS_EMAIL } from '@/lib/email';
import { refundTx } from '@/lib/paystack';
import { finalizeRefund } from '@/lib/refunds';

const STATUSES = ['new', 'payment_pending', 'payment_confirmed', 'processing', 'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled', 'refunded'];
const txt = (v: FormDataEntryValue | null, n: number) => String(v ?? '').trim().slice(0, n) || null;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse('Unauthorised', { status: 401 });
  const f = await req.formData();
  const action = String(f.get('action'));
  const to = (msg?: string) => NextResponse.redirect(new URL(`/admin/orders/${params.id}${msg ? `?msg=${encodeURIComponent(msg)}` : ''}`, req.url), 303);
  const { data: o } = await db.from('orders').select('*').eq('id', params.id).single();
  if (!o) return to();
  const now = new Date().toISOString();
  if (['status', 'note', 'tracking', 'resendEmail'].includes(action) && !can(admin, 'manage_orders')) return to('You do not have permission to change orders');
  await logActivity(admin.id, `order.${action}`, 'order', o.id, String(f.get('status') || f.get('amount') || ''));

  if (action === 'status') {
    const st = String(f.get('status'));
    if (!STATUSES.includes(st) || st === o.order_status) return to();
    await db.from('orders').update({ order_status: st, updated_at: now }).eq('id', o.id);
    await db.from('status_history').insert({ order_id: o.id, admin_id: admin.id, from_status: o.order_status, to_status: st });
    if (STATUS_EMAIL[st]) await sendOrderEmail(o.id, STATUS_EMAIL[st]);
    if (st === 'delivered') {   // creates the post-delivery follow-up task once
      const d = new Date(); d.setDate(d.getDate() + (parseInt(await getSetting('followup_days', '3'), 10) || 3));
      await db.from('follow_up_tasks').upsert({ customer_id: o.customer_id, order_id: o.id, due_date: d.toISOString().slice(0, 10) }, { onConflict: 'order_id', ignoreDuplicates: true });
    }
    return to('Status updated');
  }
  if (action === 'note') {
    await db.from('orders').update({ internal_notes: txt(f.get('notes'), 2000) }).eq('id', o.id);
    return to('Note saved');
  }
  if (action === 'tracking') {   // save these BEFORE moving the order to "dispatched" so the email includes them
    await db.from('orders').update({ courier: txt(f.get('courier'), 80), tracking_number: txt(f.get('tracking_number'), 80), tracking_url: txt(f.get('tracking_url'), 300), estimated_delivery: txt(f.get('estimated_delivery'), 10), updated_at: now }).eq('id', o.id);
    return to('Delivery details saved');
  }
  if (action === 'resendEmail') {
    const type = String(f.get('type'));
    await db.from('email_log').delete().eq('order_id', o.id).eq('type', type).eq('status', 'failed');   // only failed ones can be retried
    await sendOrderEmail(o.id, type as any);
    return to('Email retried');
  }
  if (admin.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });

  if (action === 'markPaid' && o.payment_status !== 'successful') {
    // Manual confirmation (e.g. bank transfer agreed on WhatsApp). Recorded as a manual payment with who did it.
    await db.from('payments').insert({ order_id: o.id, provider: 'manual', reference: `MANUAL-${o.order_number}`, amount_kobo: o.total_kobo, status: 'successful', paid_at: now, recorded_by: admin.id });
    await db.from('orders').update({ payment_status: 'successful', order_status: o.order_status === 'new' ? 'payment_confirmed' : o.order_status, paid_at: now, updated_at: now }).eq('id', o.id);
    await db.from('status_history').insert({ order_id: o.id, admin_id: admin.id, from_status: o.order_status, to_status: 'payment_confirmed', note: 'Marked paid manually' });
    await db.rpc('deduct_stock', { p_order: o.id });
    await backupOrder(o.id, 'PAID');
    await sendOrderEmail(o.id, 'payment_confirmation');
    return to('Marked as paid');
  }
  if (action === 'refund') {
    const amount = Math.round(Number(f.get('amount')) * 100);
    const { data: pay } = await db.from('payments').select('*').eq('order_id', o.id).eq('status', 'successful').order('created_at').limit(1).maybeSingle();
    if (!pay) return to('No successful payment to refund');
    const { data: rs } = await db.from('refunds').select('amount_kobo').eq('order_id', o.id).in('status', ['pending', 'processed']);
    const already = (rs || []).reduce((s: number, r: any) => s + r.amount_kobo, 0);
    if (!(amount > 0) || amount + already > pay.amount_kobo) return to('Refund amount is invalid or exceeds what was paid');
    const reason = txt(f.get('reason'), 200);
    try {
      if (pay.provider === 'paystack') {
        const r = await refundTx(pay.reference, amount);
        await db.from('refunds').insert({ order_id: o.id, payment_id: pay.id, amount_kobo: amount, status: 'pending', paystack_refund_id: r.id ? String(r.id) : null, reason, admin_id: admin.id });
        return to('Refund requested. It will show as processed when Paystack confirms.');
      }
      await db.from('refunds').insert({ order_id: o.id, payment_id: pay.id, amount_kobo: amount, status: 'processed', processed_at: now, reason, admin_id: admin.id });
      await finalizeRefund(o.id);
      return to('Manual refund recorded (pay the customer yourself)');
    } catch (e: any) { return to('Refund failed: ' + String(e.message).slice(0, 120)); }
  }
  return to();
}
