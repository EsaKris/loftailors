import Link from 'next/link';
import { db } from '@/lib/db';
import { requireAdmin, can } from '@/lib/auth';
import { naira } from '@/lib/offers';
import { pay, label } from '@/lib/ui';
import { Head, Empty, Avatar } from '@/components/ui';

export default async function Search({ searchParams }: { searchParams: { q?: string } }) {
  const a = await requireAdmin();
  const q = (searchParams.q || '').trim().replace(/[,()%]/g, '');
  let orders: any[] = [], customers: any[] = [];
  if (q.length >= 2) {
    [orders, customers] = await Promise.all([
      db.from('orders').select('id, order_number, total_kobo, payment_status, customers(full_name)').ilike('order_number', `%${q}%`).limit(10).then(r => r.data || []),
      can(a, 'view_customers') ? db.from('customers').select('id, full_name, phone_e164, email').or(`full_name.ilike.%${q}%,phone_e164.ilike.%${q}%,email.ilike.%${q}%`).limit(10).then(r => r.data || []) : Promise.resolve([]),
    ]);
  }
  return (
    <>
      <Head title="Search" sub={q ? `Results for “${q}”` : 'Type at least 2 characters in the search box above.'} />
      <div className="grid2">
        <div className="card"><h2>Orders</h2>{orders.map((o: any) => <Link key={o.id} href={`/admin/orders/${o.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none' }}><span><b>{o.order_number}</b><br /><small>{o.customers?.full_name}</small></span><span style={{ textAlign: 'right' }}>{naira(o.total_kobo)}<br /><span className={`pill ${pay(o.payment_status)}`}>{label(o.payment_status)}</span></span></Link>)}{!orders.length && <Empty icon="bag" title="No matching orders" />}</div>
        <div className="card"><h2>Customers</h2>{customers.map((c: any) => <Link key={c.id} href={`/admin/customers/${c.id}`} className="person" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none' }}><Avatar name={c.full_name} /><span><b>{c.full_name}</b><br /><small>{c.phone_e164}{c.email ? ` · ${c.email}` : ''}</small></span></Link>)}{!customers.length && <Empty icon="users" title="No matching customers" />}</div>
      </div>
    </>
  );
}
