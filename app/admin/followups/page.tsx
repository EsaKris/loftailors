import Link from 'next/link';
import { db } from '@/lib/db';
import { requireCan } from '@/lib/auth';
import { label } from '@/lib/ui';
import { Head, Empty, Avatar, Tile } from '@/components/ui';

const ST = ['not_contacted', 'contact_initiated', 'follow_up_required', 'completed', 'not_interested'];
const cls = (s: string) => (s === 'completed' ? 'ok' : s === 'not_interested' ? '' : s === 'not_contacted' ? 'warn' : 'info');
export default async function Followups({ searchParams }: { searchParams: { f?: string } }) {
  await requireCan('view_customers');
  const f = searchParams.f || 'open', today = new Date().toISOString().slice(0, 10);
  const { data: all } = await db.from('follow_up_tasks').select('*, customers(id, full_name, phone_e164), orders(id, order_number)').order('due_date').limit(300);
  const openT = (all || []).filter((t: any) => !['completed', 'not_interested'].includes(t.status)), overdue = openT.filter((t: any) => t.due_date < today);
  const list = f === 'all' ? all || [] : f === 'overdue' ? overdue : openT;
  const { data: tpl } = await db.from('whatsapp_templates').select('id').eq('name', 'Delivery follow-up').maybeSingle();
  return (
    <>
      <Head title="Follow-ups" sub="A task is created automatically when an order is marked delivered.">
        <div className="seg">{[['open', 'Open'], ['overdue', 'Overdue'], ['all', 'All']].map(([k, l]) => <Link key={k} className={f === k ? 'on' : ''} href={`/admin/followups?f=${k}`}>{l}</Link>)}</div></Head>
      <div className="tiles"><Tile icon="heart" cls="v" label="Open" value={openT.length} /><Tile icon="bell" cls="o" label="Overdue" value={overdue.length} /><Tile icon="chat" cls="k" label="Completed" value={(all || []).filter((t: any) => t.status === 'completed').length} /></div>
      {list.length ? <div className="grid2">{list.map((t: any) => (
        <form key={t.id} className="card" method="post" action="/api/admin/followups"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="f" value={f} />
          <div className="person" style={{ marginBottom: 14 }}><Avatar name={t.customers?.full_name} /><div style={{ flex: 1, minWidth: 0 }}><b>{t.customers?.full_name}</b><br /><small>{t.customers?.phone_e164} · <Link href={`/admin/orders/${t.orders?.id}`}>{t.orders?.order_number}</Link></small></div>
            <span className={`pill ${cls(t.status)}`}>{label(t.status)}</span></div>
          {t.due_date < today && !['completed', 'not_interested'].includes(t.status) && <p><span className="pill bad">Overdue since {t.due_date}</span></p>}
          <div className="fgrid"><label className="fld"><span>Status</span><select name="status" defaultValue={t.status}>{ST.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label><label className="fld"><span>Due date</span><input type="date" name="due_date" defaultValue={t.due_date} /></label></div>
          <label className="fld" style={{ marginTop: 12 }}><span>Notes</span><input name="notes" defaultValue={t.notes || ''} placeholder="What did they say?" /></label>
          <div className="actions" style={{ marginTop: 14 }}><button className="btn">Save</button><a className="btn wa" target="_blank" rel="noopener noreferrer" href={`/api/admin/wa?c=${t.customers?.id}&o=${t.orders?.id}${tpl ? `&t=${tpl.id}` : ''}`}>WhatsApp</a></div>
        </form>))}</div> : <div className="card"><Empty icon="heart" title="Nothing to follow up" text="When you mark an order delivered, a follow-up task appears here after the number of days set in Offers & settings." /></div>}
    </>
  );
}
