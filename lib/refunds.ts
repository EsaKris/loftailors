import { db } from './db';
import { sendOrderEmail } from './email';
import { notify } from './notify';
// Recomputes the order's payment state from processed refunds. Safe to call repeatedly.
export async function finalizeRefund(orderId: string) {
  const { data: o } = await db.from('orders').select('total_kobo, payment_status').eq('id', orderId).single();
  const { data: rs } = await db.from('refunds').select('amount_kobo').eq('order_id', orderId).eq('status', 'processed');
  const sum = (rs || []).reduce((s: number, r: any) => s + r.amount_kobo, 0);
  if (!o || !sum) return;
  const full = sum >= o.total_kobo;
  await db.from('orders').update({ payment_status: full ? 'refunded' : 'partially_refunded', ...(full ? { order_status: 'refunded' } : {}), updated_at: new Date().toISOString() }).eq('id', orderId);
  await notify('refund', full ? 'Order fully refunded' : 'Partial refund processed', undefined, `/admin/orders/${orderId}`, `refund:${orderId}:${sum}`);
  await sendOrderEmail(orderId, 'refund_confirmation');
}
// Called by the Paystack webhook. Matches by the transaction reference we stored.
export async function markRefundFromWebhook(txRef: string, paystackRefundId?: string) {
  const { data: pay } = await db.from('payments').select('id, order_id').eq('reference', txRef).maybeSingle();
  if (!pay) return;
  const { data: r } = await db.from('refunds').select('id').eq('payment_id', pay.id).eq('status', 'pending').order('created_at').limit(1).maybeSingle();
  if (r) await db.from('refunds').update({ status: 'processed', processed_at: new Date().toISOString(), paystack_refund_id: paystackRefundId ?? null }).eq('id', r.id);
  await finalizeRefund(pay.order_id);
}
