import { db } from './db';
import { verifyTx } from './paystack';
import { sendOrderEmail } from './email';
import { notify } from './notify';
import { backupOrder } from './sheets';
import { deductGifts } from './gifts';

// The ONLY place an order becomes "paid". Always asks Paystack directly (server-side),
// checks amount + currency against what we stored, and is safe to call many times.
export async function settlePayment(reference: string): Promise<{ ok: boolean; status: string }> {
  const { data: pay } = await db.from('payments').select('*').eq('reference', reference).maybeSingle();
  if (!pay) return { ok: false, status: 'unknown' };
  const d = await verifyTx(reference);
  if (d.status !== 'success') {
    const st = d.status === 'abandoned' ? 'abandoned' : d.status === 'failed' ? 'failed' : 'pending';
    if (st !== 'pending') {
      await notify('payment', `Payment ${st}`, `Order ${pay.order_id}`, `/admin/orders/${pay.order_id}`, `pay-${st}:${pay.id}`);
      await db.from('payments').update({ status: st, raw: d }).eq('id', pay.id).neq('status', 'successful');
      await db.from('orders').update({ payment_status: st, updated_at: new Date().toISOString() }).eq('id', pay.order_id).neq('payment_status', 'successful');
    }
    return { ok: false, status: st };
  }
  if (d.amount !== pay.amount_kobo || d.currency !== pay.currency) {
    await db.from('payments').update({ status: 'failed', raw: { mismatch: true, paystack: d } }).eq('id', pay.id).neq('status', 'successful');
    console.error('Paystack amount mismatch', reference, d.amount, pay.amount_kobo);
    return { ok: false, status: 'mismatch' };
  }
  // Conditional update: only the first caller flips pending -> successful, so webhook + callback never double-process.
  const { data: flipped } = await db.from('payments').update({ status: 'successful', channel: d.channel ?? null, fees_kobo: d.fees ?? null, paid_at: d.paid_at ?? new Date().toISOString(), raw: d }).eq('id', pay.id).neq('status', 'successful').select('id');
  if (flipped && flipped.length) {
    await db.from('orders').update({ payment_status: 'successful', order_status: 'payment_confirmed', paid_at: d.paid_at ?? new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', pay.order_id);
    await db.from('status_history').insert({ order_id: pay.order_id, from_status: 'payment_pending', to_status: 'payment_confirmed', note: 'Paystack payment verified' });
    await db.rpc('deduct_stock', { p_order: pay.order_id });
    await deductGifts(pay.order_id);
    await backupOrder(pay.order_id, 'PAID');
    await notify('payment', 'Payment confirmed', `Order paid by card`, `/admin/orders/${pay.order_id}`, `paid:${pay.order_id}`);
    const { data: vs } = await db.from('variant_stock').select('id,size,colour,stock,low_stock_at');
    for (const v of vs || []) if (v.stock <= v.low_stock_at) await notify('stock', `${v.stock <= 0 ? 'Out of stock' : 'Low stock'}: ${v.colour} ${v.size}`, `${v.stock} left`, '/admin/inventory', `low:${v.id}:${v.stock}`);
    await sendOrderEmail(pay.order_id, 'payment_confirmation');
  }
  return { ok: true, status: 'successful' };
}
