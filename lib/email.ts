import { db } from './db';
import { naira } from './offers';

type Type = 'refund_confirmation' | 'order_received' | 'payment_confirmation' | 'processing' | 'ready_for_dispatch' | 'dispatched' | 'delivered' | 'cancelled';
export const COPY: Record<Type, { subject: string; line: string }> = {
  order_received: { subject: 'We’ve received your LOFT order', line: 'Thank you for your order. We have it and will confirm the details with you shortly.' },
  payment_confirmation: { subject: 'Payment confirmed — LOFT', line: 'Your payment has been confirmed. Thank you.' },
  processing: { subject: 'Your LOFT order is being prepared', line: 'We are getting your order ready.' },
  ready_for_dispatch: { subject: 'Your LOFT order is ready for dispatch', line: 'Your order is packed and ready to go out with GIG Logistics.' },
  dispatched: { subject: 'Your LOFT order is on its way', line: 'Your order has been dispatched with GIG Logistics.' },
  delivered: { subject: 'Your LOFT order has been delivered', line: 'Your order is marked as delivered. We hope you enjoy it.' },
  refund_confirmation: { subject: 'Your LOFT refund', line: 'A refund has been processed for your order. Your bank may take a few days to show it.' },
  cancelled: { subject: 'Your LOFT order was cancelled', line: 'Your order has been cancelled. Contact us on WhatsApp if this is unexpected.' },
};
export const STATUS_EMAIL: Record<string, Type> = { processing: 'processing', ready_for_dispatch: 'ready_for_dispatch', dispatched: 'dispatched', delivered: 'delivered', cancelled: 'cancelled' };
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Idempotent and failure-safe: never throws, so an email problem can never lose a payment or order.
export async function sendOrderEmail(orderId: string, type: Type) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const { data: o } = await db.from('orders').select('*, customers(*), order_items(*)').eq('id', orderId).single();
    const to = o?.customers?.email;
    if (!o || !to) return;
    const { data: ov } = await db.from('email_templates').select('*').eq('type', type).maybeSingle();
    if (ov && !ov.active) return;   // this notification type is switched off in the dashboard
    const fl = (s: string) => s.replace(/\{\{customer_name\}\}/g, o.customers.full_name.split(' ')[0]).replace(/\{\{order_number\}\}/g, o.order_number).replace(/\{\{order_amount\}\}/g, naira(o.total_kobo));
    const c = { subject: fl(ov?.subject || COPY[type].subject), line: fl(ov?.line || COPY[type].line) };
    // The unique (order_id, type) constraint makes duplicate triggers a no-op.
    const { error: dup } = await db.from('email_log').insert({ order_id: orderId, customer_id: o.customer_id, type, to_email: to, subject: c.subject, status: 'queued' });
    if (dup) return;
    const items = (o.order_items || []).map((i: any, n: number) => `<tr><td style="padding:6px 0">${n + 1}. LOFT Joggers</td><td style="padding:6px 0;text-align:right">${esc(i.colour)} · ${esc(i.size)}</td></tr>`).join('');
    const html = `<div style="background:#f6f3ee;padding:24px;font-family:Arial,sans-serif;color:#111"><div style="max-width:520px;margin:0 auto;background:#fff"><div style="background:#000;color:#fff;padding:22px;text-align:center;letter-spacing:.3em;font-weight:bold">LOFT</div><div style="padding:26px"><p>Hello ${esc(o.customers.full_name.split(' ')[0])},</p><p>${c.line}</p><p style="color:#666;margin:18px 0 6px">Order ${esc(o.order_number)}</p><table width="100%" style="border-collapse:collapse;font-size:15px">${items}<tr><td style="padding:10px 0;border-top:1px solid #ddd"><b>Total</b></td><td style="padding:10px 0;border-top:1px solid #ddd;text-align:right"><b>${naira(o.total_kobo)}</b></td></tr></table>${o.free_items ? `<p>Free: ${esc(o.free_items)}</p>` : ''}${type === 'dispatched' && (o.courier || o.tracking_number) ? `<p>${o.courier ? 'Courier: ' + esc(o.courier) + '<br>' : ''}${o.tracking_number ? 'Tracking number: ' + esc(o.tracking_number) + '<br>' : ''}${o.tracking_url ? `<a href="${esc(o.tracking_url)}">Track your order</a><br>` : ''}${o.estimated_delivery ? 'Expected: ' + esc(String(o.estimated_delivery)) : ''}</p>` : ''}<p style="color:#666;font-size:13px;margin-top:26px">LOFT — Lilies of the Field Tailors. Questions? WhatsApp us on 0704 777 3134.</p></div></div></div>`;
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], reply_to: process.env.EMAIL_REPLY_TO || undefined, subject: c.subject, html }) });
    const j = await r.json().catch(() => ({}));
    await db.from('email_log').update(r.ok ? { status: 'sent', provider_id: j.id } : { status: 'failed', error: JSON.stringify(j).slice(0, 500) }).eq('order_id', orderId).eq('type', type);
  } catch (e) { console.error('email error', e); }
}
