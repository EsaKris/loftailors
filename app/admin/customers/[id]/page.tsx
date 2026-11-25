import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireCan } from '@/lib/auth';
import { naira } from '@/lib/offers';
import { pay, stat, label, lagos } from '@/lib/ui';
import { Avatar, Empty, Tile } from '@/components/ui';

export default async function Customer({ params }: { params: { id: string } }) {
  await requireCan('view_customers');
  const { data: c } = await db.from('customers').select('*').eq('id', params.id).maybeSingle();
  if (!c) notFound();
  const { data: os } = await db.from('orders').select('id, order_number, total_kobo, pack_qty, payment_status, order_status, created_at, order_items(size, colour)').eq('customer_id', c.id).order('created_at', { ascending: false });
  const { data: tpls } = await db.from('whatsapp_templates').select('id,name,category').order('sort');
  const paid = (os || []).filter((o: any) => o.payment_status === 'successful');
  const spent = paid.reduce((a: number, o: any) => a + o.total_kobo, 0), last = paid[0]?.created_at;
  return (
    <>
      <p style={{ margin: 0 }}><Link href="/admin/customers" className="muted" style={{ textDecoration: 'none' }}>← Customers</Link></p>
      <div className="card" style={{ margin: '12px 0 20px' }}>
        <div className="pagehead" style={{ margin: 0 }}>
          <div className="person"><Avatar name={c.full_name} lg /><div><h1 style={{ margin: 0 }}>{c.full_name}</h1>
            <p className="sub" style={{ margin: '4px 0 8px' }}>{c.phone_e164}{c.email ? ` · ${c.email}` : ''}<br />{[c.address, c.city, c.state].filter(Boolean).join(', ')}</p>
            <span className="actions">{paid.length > 1 && <span className="pill info">Repeat customer</span>}{c.marketing_consent ? <span className="pill ok">Opted in to marketing</span> : <span className="pill">Not opted in</span>}</span></div></div>
          <div className="actions"><a className="btn wa" target="_blank" rel="noopener noreferrer" href={`/api/admin/wa?c=${c.id}`}>WhatsApp</a></div>
        </div>
        <p className="muted" style={{ margin: '16px 0 8px' }}>Message with a template (opens WhatsApp; you press send):</p>
        <div className="actions">{(tpls || []).filter((t: any) => t.category !== 'promo' || c.marketing_consent).map((t: any) => <a key={t.id} className="btn alt" style={{ minHeight: 34, fontSize: 12.5 }} target="_blank" rel="noopener noreferrer" href={`/api/admin/wa?c=${c.id}&t=${t.id}`}>{t.name}</a>)}</div>
        {!c.marketing_consent && <p className="muted" style={{ margin: '12px 0 0' }}>Promotional messages are blocked for this customer.</p>}
      </div>
      <div className="tiles">
        <Tile icon="bag" cls="v" label="Orders" value={os?.length ?? 0} />
        <Tile icon="wallet" cls="o" label="Verified spend" value={naira(spent)} />
        <Tile icon="chart" cls="g" label="Average order" value={paid.length ? naira(Math.round(spent / paid.length)) : '—'} />
        <Tile icon="heart" cls="k" label="Last paid order" value={last ? lagos(last).split(',')[0] : '—'} />
      </div>
      <h2>Purchase history</h2>
      <div className="scroll"><table className="rt"><thead><tr><th>Order</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead><tbody>
        {(os || []).map((o: any) => <tr key={o.id}><td data-label="Order"><Link href={`/admin/orders/${o.id}`}><b>{o.order_number}</b></Link></td><td data-label="Items">{o.order_items.map((i: any) => `${i.colour} ${i.size}`).join(', ')}</td><td data-label="Total">{naira(o.total_kobo)}</td><td data-label="Payment"><span className={`pill ${pay(o.payment_status)}`}>{label(o.payment_status)}</span></td><td data-label="Status"><span className={`pill ${stat(o.order_status)}`}>{label(o.order_status)}</span></td><td data-label="Date">{lagos(o.created_at)}</td></tr>)}
        {!os?.length && <tr><td colSpan={6}><Empty icon="bag" title="No orders yet" /></td></tr>}</tbody></table></div>
    </>
  );
}
