import Link from 'next/link';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { naira } from '@/lib/offers';
import { pay, stat, label, lagos } from '@/lib/ui';

const TABS = [['', 'All'], ['new', 'New'], ['payment_pending', 'Awaiting payment'], ['payment_confirmed', 'Paid'], ['processing', 'Processing'], ['ready_for_dispatch', 'Ready'], ['dispatched', 'Dispatched'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
export default async function Orders({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await requireAdmin();
  let q = db.from('orders').select('id, order_number, total_kobo, pack_qty, channel, payment_status, order_status, created_at, customers(full_name, phone_e164)').order('created_at', { ascending: false }).limit(100);
  if (searchParams.status) q = q.eq('order_status', searchParams.status);
  if (searchParams.q) q = q.ilike('order_number', `%${searchParams.q.trim().replace(/[%,()]/g, '')}%`);
  const { data } = await q;
  const cur = searchParams.status || '';
  return (
    <>
      <div className="pagehead"><div><h1>Orders</h1><p className="sub">Newest first. Tap an order to manage it.</p></div>
        <form className="filters"><input name="q" placeholder="Search order number" defaultValue={searchParams.q} />{cur && <input type="hidden" name="status" value={cur} />}<button className="btn">Search</button></form></div>
      <div className="chips">{TABS.map(([k, l]) => <Link key={k} className={`chip${cur === k ? ' on' : ''}`} href={k ? `/admin/orders?status=${k}` : '/admin/orders'}>{l}</Link>)}</div>
      <div className="scroll"><table className="rt"><thead><tr><th>Order</th><th>Customer</th><th>Offer</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed</th></tr></thead><tbody>
        {(data || []).map((o: any) => <tr key={o.id}>
          <td data-label="Order"><Link href={`/admin/orders/${o.id}`}><b>{o.order_number}</b></Link><br /><small>{o.channel === 'card' ? 'Card' : 'WhatsApp'}</small></td>
          <td data-label="Customer">{o.customers?.full_name}<br /><small>{o.customers?.phone_e164}</small></td>
          <td data-label="Offer">{o.pack_qty} {o.pack_qty > 1 ? 'joggers' : 'jogger'}</td><td data-label="Total">{naira(o.total_kobo)}</td>
          <td data-label="Payment"><span className={`pill ${pay(o.payment_status)}`}>{label(o.payment_status)}</span></td>
          <td data-label="Status"><span className={`pill ${stat(o.order_status)}`}>{label(o.order_status)}</span></td><td data-label="Placed">{lagos(o.created_at)}</td></tr>)}
        {!data?.length && <tr><td colSpan={7} className="empty">No orders match.</td></tr>}</tbody></table></div>
    </>
  );
}
