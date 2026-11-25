import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSuper } from '@/lib/auth';
import { Head, Empty, Avatar } from '@/components/ui';

export default async function Duplicates() {
  await requireSuper();
  const { data: cs } = await db.from('customers').select('*').order('created_at').limit(3000);
  const { data: dis } = await db.from('duplicate_dismissals').select('a,b');
  const { data: os } = await db.from('orders').select('customer_id');
  const dismissed = new Set((dis || []).map((d: any) => `${d.a}|${d.b}`));
  const cnt = (id: string) => (os || []).filter((o: any) => o.customer_id === id).length;
  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const groups = new Map<string, any[]>();
  (cs || []).forEach((c: any) => {
    if (c.email) { const k = 'email:' + c.email.toLowerCase(); groups.set(k, [...(groups.get(k) || []), c]); }
    if (c.address && c.full_name) { const k = 'name+address:' + norm(c.full_name) + '|' + norm(c.address); groups.set(k, [...(groups.get(k) || []), c]); }
  });
  const pairs: { keep: any; dup: any; why: string }[] = [], seen = new Set<string>();
  groups.forEach((list, k) => { if (list.length < 2) return; const [keep, ...rest] = list; rest.forEach(dup => { const [x, y] = [keep.id, dup.id].sort(); if (dismissed.has(`${x}|${y}`) || seen.has(`${x}|${y}`)) return; seen.add(`${x}|${y}`); pairs.push({ keep, dup, why: k.startsWith('email') ? 'Same email, different phone' : 'Same name and address, different phone' }); }); });
  return (
    <>
      <Head title="Possible duplicates" sub="Customers are matched by phone. These share an email, or a name and address. You decide; nothing merges automatically." />
      {pairs.length ? <div className="grid2">{pairs.map((p, i) => (
        <div key={i} className="card"><span className="pill warn">{p.why}</span>
          <div className="cmp mt">{[p.keep, p.dup].map((c: any, n: number) => <div key={c.id}><div className="k">{n === 0 ? 'Keep (older)' : 'Duplicate'}</div><div className="person" style={{ marginBottom: 8 }}><Avatar name={c.full_name} /><b><Link href={`/admin/customers/${c.id}`}>{c.full_name}</Link></b></div>
            <div className="kvl"><div><span>Phone</span><span>{c.phone_e164}</span></div><div><span>Email</span><span>{c.email || '—'}</span></div><div><span>Orders</span><span>{cnt(c.id)}</span></div></div></div>)}</div>
          <form method="post" action="/api/admin/duplicates" className="actions mt"><input type="hidden" name="keep" value={p.keep.id} /><input type="hidden" name="dup" value={p.dup.id} /><button className="btn" name="do" value="merge">Merge into older profile</button><button className="btn alt" name="do" value="dismiss">Not the same person</button></form>
          <p className="muted" style={{ marginBottom: 0 }}>Merging moves orders, follow-ups and messages to the older profile and cannot be undone.</p></div>))}</div>
        : <div className="card"><Empty icon="copy" title="No possible duplicates" text="If two customer profiles ever look like the same person, they will appear here." /></div>}
    </>
  );
}
