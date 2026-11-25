import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { naira } from '@/lib/offers';
import { pay, stat, label, lagos } from '@/lib/ui';

const STATUSES = ['new', 'payment_pending', 'payment_confirmed', 'processing', 'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled', 'refunded'];
const post = (id: string) => `/api/admin/orders/${id}`;
export default async function OrderPage({ params, searchParams }: { params: { id: string }; searchParams: { msg?: string } }) {
  const admin = await requireAdmin();
  const { data: o } = await db.from('orders').select('*, customers(*), order_items(*), payments(*), refunds(*), status_history(*), email_log(*)').eq('id', params.id).maybeSingle();
  if (!o) notFound();
  const c = o.customers;
  const { data: tpls } = await db.from('whatsapp_templates').select('id,name,category').order('sort');
  const wa = (t?: string) => `/api/admin/wa?c=${c.id}&o=${o.id}${t ? `&t=${t}` : ''}`;
  const paidPay = o.payments.find((p: any) => p.status === 'successful');
  return (
    <>
      <p style={{ margin: 0 }}><Link href="/admin/orders" className="muted" style={{ textDecoration: 'none' }}>← Orders</Link></p>
      <div className="pagehead"><div><h1>{o.order_number}</h1><p className="sub"><span className={`pill ${pay(o.payment_status)}`}>{label(o.payment_status)}</span> <span className={`pill ${stat(o.order_status)}`}>{label(o.order_status)}</span> · placed {lagos(o.created_at)} · {o.channel === 'card' ? 'Card' : 'WhatsApp'}</p></div>
        <div className="filters"><a className="btn wa" target="_blank" rel="noopener noreferrer" href={wa()}>WhatsApp customer</a><a className="btn alt" href={`/admin/orders/${o.id}/print`}>Print / PDF</a></div></div>
      {searchParams.msg && <p className="flash">{searchParams.msg}</p>}
      <div className="ogrid">
        <div>
          <div className="card"><h2>Items</h2>
            <div className="stack">{o.order_items.map((i: any, n: number) => <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{n + 1}. {i.product}</span><span className="muted">{i.colour} · {i.size}</span></div>)}</div>
            {o.free_items && <p className="pill info" style={{ marginTop: 12 }}>Free: {o.free_items}</p>}
            <dl className="kv" style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}><dt>Subtotal</dt><dd>{naira(o.subtotal_kobo)}</dd><dt>Delivery</dt><dd>{o.delivery_kobo === null ? 'To be confirmed' : naira(o.delivery_kobo)}</dd><dt><b>Total</b></dt><dd><b>{naira(o.total_kobo)}</b></dd></dl></div>
          <form className="card" method="post" action={post(o.id)}><h2>Delivery details</h2><input type="hidden" name="action" value="tracking" />
            <div className="row2"><input name="courier" placeholder="Courier / rider" defaultValue={o.courier || ''} /><input name="tracking_number" placeholder="Tracking number (if any)" defaultValue={o.tracking_number || ''} /><input name="tracking_url" placeholder="Tracking link (optional)" defaultValue={o.tracking_url || ''} /><input name="estimated_delivery" type="date" defaultValue={o.estimated_delivery || ''} /></div>
            <p className="muted" style={{ margin: '12px 0' }}>Save these first, then mark the order dispatched so the customer&apos;s email includes them.</p><button className="btn">Save delivery details</button></form>
          <div className="card"><h2>Payments</h2>{o.payments.length ? <div className="stack">{o.payments.map((p: any) => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><span><b>{naira(p.amount_kobo)}</b> <small>{p.provider}{p.channel ? ` · ${p.channel}` : ''}{p.fees_kobo != null ? ` · fee ${naira(p.fees_kobo)}` : ''}</small><br /><small>{p.reference}</small></span><span className={`pill ${pay(p.status)}`}>{label(p.status)}</span></div>)}</div> : <p className="muted" style={{ margin: 0 }}>No payment records.</p>}
            {o.refunds.length > 0 && <><h2 className="mt">Refunds</h2><div className="stack">{o.refunds.map((r: any) => <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{naira(r.amount_kobo)} <small>{r.reason || ''} · {lagos(r.created_at)}</small></span><span className={`pill ${r.status === 'processed' ? 'ok' : 'warn'}`}>{label(r.status)}</span></div>)}</div></>}</div>
          <div className="card"><h2>Emails to customer</h2>{o.email_log.length ? <div className="stack">{o.email_log.map((e: any) => <form key={e.id} method="post" action={post(o.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}><span>{label(e.type)} <small>→ {e.to_email}</small>{e.error && <><br /><small style={{ color: 'var(--bad)' }}>{e.error.slice(0, 90)}</small></>}</span><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className={`pill ${['sent', 'delivered'].includes(e.status) ? 'ok' : e.status === 'failed' || e.status === 'bounced' ? 'bad' : 'warn'}`}>{label(e.status)}</span>{e.status === 'failed' && <><input type="hidden" name="action" value="resendEmail" /><input type="hidden" name="type" value={e.type} /><button className="btn alt" style={{ minHeight: 32 }}>Retry</button></>}</span></form>)}</div> : <p className="muted" style={{ margin: 0 }}>No emails sent. The customer may not have given an email.</p>}</div>
          <div className="card"><h2>History</h2><div className="tl">{[...o.status_history].sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at)).map((h: any) => <div key={h.id}><b>{label(h.to_status)}</b>{h.note ? ` · ${h.note}` : ''}<br /><small>{lagos(h.created_at)}{h.from_status ? ` · from ${label(h.from_status)}` : ''}</small></div>)}{!o.status_history.length && <small>No changes yet.</small>}</div></div>
        </div>
        <div>
          <div className="card"><h2>Customer</h2><b>{c.full_name}</b><br />{c.phone_e164}<br />{c.email || <span className="muted">No email</span>}<p style={{ margin: '10px 0' }}>{o.delivery_address}, {o.city}, {o.state}</p>{o.customer_note && <p className="flash">Note: {o.customer_note}</p>}
            <Link className="btn alt" href={`/admin/customers/${c.id}`}>View profile</Link>
            <p className="muted" style={{ margin: '16px 0 8px' }}>Message with a template (opens WhatsApp; you press send):</p>
            <div className="filters" style={{ margin: 0 }}>{(tpls || []).filter((t: any) => t.category !== 'promo' || c.marketing_consent).map((t: any) => <a key={t.id} className="btn alt" style={{ minHeight: 34, fontSize: 12.5 }} target="_blank" rel="noopener noreferrer" href={wa(t.id)}>{t.name}</a>)}</div></div>
          <form className="card" method="post" action={post(o.id)}><h2>Order status</h2><input type="hidden" name="action" value="status" />
            <div className="filters" style={{ margin: 0 }}><select name="status" defaultValue={o.order_status} style={{ flex: 1 }}>{STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}</select><button className="btn">Update</button></div>
            <p className="muted" style={{ margin: '12px 0 0' }}>Processing, ready, dispatched, delivered and cancelled each email the customer once.</p></form>
          <form className="card" method="post" action={post(o.id)}><h2>Internal notes</h2><input type="hidden" name="action" value="note" /><textarea name="notes" rows={4} defaultValue={o.internal_notes || ''} /><button className="btn mt">Save note</button></form>
          {admin.role === 'super' && o.payment_status !== 'successful' && <form className="card" method="post" action={post(o.id)}><h2>Manual payment</h2><input type="hidden" name="action" value="markPaid" /><p className="muted" style={{ marginTop: 0 }}>Only after you have actually received the money (for example a bank transfer). Recorded against your name.</p><button className="btn alt">Mark as paid</button></form>}
          {admin.role === 'super' && paidPay && <form className="card" method="post" action={post(o.id)}><h2>Refund</h2><input type="hidden" name="action" value="refund" /><div className="stack"><input name="amount" type="number" step="0.01" min="1" defaultValue={(paidPay.amount_kobo / 100).toString()} /><input name="reason" placeholder="Reason" /></div><p className="muted">{paidPay.provider === 'paystack' ? 'Sent to Paystack; shows processed when Paystack confirms.' : 'Manual payment: records the refund only. You return the money yourself.'}</p><button className="btn alt">Refund</button></form>}
        </div>
      </div>
    </>
  );
}
