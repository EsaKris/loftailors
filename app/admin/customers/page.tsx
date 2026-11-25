import Link from 'next/link';
import { db } from '@/lib/db';
import { requireCan } from '@/lib/auth';
import { naira } from '@/lib/offers';

export default async function Customers({ searchParams }: { searchParams: { q?: string } }) {
  await requireCan('view_customers');
  let q = db.from('customers').select('*').order('created_at', { ascending: false }).limit(100);
  const s = (searchParams.q || '').trim().replace(/[,()%]/g, '');
  if (s) q = q.or(`full_name.ilike.%${s}%,phone_e164.ilike.%${s}%,email.ilike.%${s}%`);
  const { data: cs } = await q;
  const ids = (cs || []).map((c: any) => c.id);
  const { data: os } = ids.length ? await db.from('orders').select('customer_id,total_kobo,payment_status').in('customer_id', ids) : { data: [] as any[] };
  const stat = (id: string) => { const m = (os || []).filter((o: any) => o.customer_id === id); const paid = m.filter((o: any) => o.payment_status === 'successful'); return { n: m.length, spent: paid.reduce((a: number, o: any) => a + o.total_kobo, 0) }; };
  return (
    <>
      <div className="pagehead"><div><h1>Customers</h1><p className="sub">Everyone who has placed an order, matched by phone number.</p></div>
        <form className="filters"><input name="q" placeholder="Name, phone or email" defaultValue={searchParams.q} /><button className="btn">Search</button></form></div>
      <div className="scroll"><table className="rt"><thead><tr><th>Name</th><th>Phone</th><th>Orders</th><th>Verified spend</th><th>Marketing</th><th /></tr></thead><tbody>
        {(cs || []).map((c: any) => { const t = stat(c.id); return <tr key={c.id}>
          <td data-label="Name"><Link href={`/admin/customers/${c.id}`}><b>{c.full_name}</b></Link><br /><small>{c.city}{c.state ? `, ${c.state}` : ''}</small></td>
          <td data-label="Phone">{c.phone_e164}</td><td data-label="Orders">{t.n}{t.n > 1 && <> <span className="pill info">repeat</span></>}</td><td data-label="Spend">{naira(t.spent)}</td>
          <td data-label="Marketing">{c.marketing_consent ? <span className="pill ok">Opted in</span> : <span className="pill">No</span>}</td>
          <td data-label=""><a className="btn wa" style={{ minHeight: 36 }} target="_blank" rel="noopener noreferrer" href={`/api/admin/wa?c=${c.id}`}>WhatsApp</a></td></tr>; })}
        {!cs?.length && <tr><td colSpan={6} className="empty">No customers yet.</td></tr>}</tbody></table></div>
    </>
  );
}
