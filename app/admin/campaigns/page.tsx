import { db } from '@/lib/db';
import { requireSuper } from '@/lib/auth';
import { lagos } from '@/lib/ui';
import { Head, Tile, Flash, Empty } from '@/components/ui';

export default async function Campaigns({ searchParams }: { searchParams: { msg?: string } }) {
  await requireSuper();
  const { count } = await db.from('customers').select('id', { count: 'exact', head: true }).eq('marketing_consent', true).not('email', 'is', null);
  const { count: optedOut } = await db.from('customers').select('id', { count: 'exact', head: true }).not('opted_out_at', 'is', null);
  const { data: past } = await db.from('campaigns').select('*').order('created_at', { ascending: false }).limit(20);
  return (
    <>
      <Head title="Promotional email" sub="Only customers who ticked the marketing box and gave an email. Every message has an unsubscribe link." />
      <Flash msg={searchParams.msg} />
      <div className="tiles"><Tile icon="mega" cls="v" label="Will receive it" value={count ?? 0} /><Tile icon="shield" cls="o" label="Unsubscribed" value={optedOut ?? 0} /><Tile icon="mail" cls="k" label="Campaigns sent" value={past?.length ?? 0} /></div>
      <div className="two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        <form className="card" method="post" action="/api/admin/campaigns"><h2>New campaign</h2>
          <div className="stack"><label className="fld"><span>Subject</span><input name="subject" required /></label><label className="fld"><span>Message (plain text). Each email starts with “Hello {'{first name}'},” automatically.</span><textarea name="body" rows={8} required /></label></div>
          <label className="tg" style={{ margin: '14px 0' }}><input type="checkbox" name="confirm" />I understand this emails all {count ?? 0} opted-in customers</label>
          <div className="actions"><button className="btn alt" name="do" value="test">Send a test to myself</button><button className="btn" name="do" value="send">Send to opted-in customers</button></div></form>
        <div className="card"><h2>Past campaigns</h2>{(past || []).map((c: any) => <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}><b>{c.subject}</b><br /><small>{lagos(c.created_at)} · {c.sent} sent{c.failed ? `, ${c.failed} failed` : ''}</small></div>)}{!past?.length && <Empty icon="mega" title="No campaigns yet" />}</div>
      </div>
      <p className="muted">Order and payment emails are separate and unaffected. Send a test to yourself first.</p>
    </>
  );
}
