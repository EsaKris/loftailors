import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { naira } from '@/lib/offers';
export default async function Print({ params }: { params: { id: string } }) {
  await requireAdmin();
  const { data: o } = await db.from('orders').select('*, customers(*), order_items(*)').eq('id', params.id).maybeSingle();
  if (!o) notFound();
  return (
    <div style={{ maxWidth: 640 }}>
      <p className="noprint" style={{ color: 'var(--mute)' }}>Use your browser&apos;s Print (Ctrl/Cmd + P) and choose &ldquo;Save as PDF&rdquo;.</p>
      <h1 style={{ letterSpacing: '.3em' }}>LOFT</h1><p>LILIES OF THE FIELD TAILORS</p>
      <h2>Order {o.order_number}</h2><p>{new Date(o.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}</p>
      <p><b>{o.customers.full_name}</b><br />{o.customers.phone_e164}<br />{o.delivery_address}, {o.city}, {o.state}</p>
      <table><thead><tr><th>Item</th><th>Colour</th><th>Size</th></tr></thead><tbody>{o.order_items.map((i: any) => <tr key={i.id}><td>{i.product}</td><td>{i.colour}</td><td>{i.size}</td></tr>)}</tbody></table>
      {o.free_items && <p>Free: {o.free_items}</p>}
      <p>Subtotal {naira(o.subtotal_kobo)}<br />Delivery {o.delivery_kobo === null ? 'to be confirmed' : naira(o.delivery_kobo)}<br /><b>Total {naira(o.total_kobo)}</b><br />Payment: {o.payment_status}</p>
    </div>
  );
}
