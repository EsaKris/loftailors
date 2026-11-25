import { db } from '@/lib/db';
import { requireSuper } from '@/lib/auth';
import { COPY } from '@/lib/email';
import { label } from '@/lib/ui';
import { Head, Tile } from '@/components/ui';

export default async function Emails() {
  await requireSuper();
  const { data: ov } = await db.from('email_templates').select('*');
  const { data: log } = await db.from('email_log').select('status').limit(5000);
  const n = (s: string) => (log || []).filter((l: any) => l.status === s).length;
  return (
    <>
      <Head title="Email notifications" sub="Order, payment, delivery and refund emails sent to customers." />
      <div className="tiles"><Tile icon="mail" cls="v" label="Sent" value={n('sent') + n('delivered')} /><Tile icon="chat" cls="k" label="Delivered" value={n('delivered')} /><Tile icon="bell" cls="o" label="Failed" value={n('failed')} /><Tile icon="shield" cls="g" label="Bounced / spam" value={n('bounced') + n('complained')} /></div>
      <div className="card" style={{ marginBottom: 18 }}><p className="muted" style={{ margin: 0 }}>Edit the subject and message, or switch a type off. Placeholders: {'{{customer_name}} {{order_number}} {{order_amount}}'}. The order items, total and delivery details are added automatically. Delivered, bounced and spam status needs the Resend webhook (see README). Failed emails can be retried from each order.</p></div>
      <div className="grid2">{Object.entries(COPY).map(([type, d]) => { const o = (ov || []).find((x: any) => x.type === type); const off = o && !o.active; return (
        <form key={type} className="card" method="post" action="/api/admin/emails" style={off ? { opacity: .7 } : undefined}><input type="hidden" name="type" value={type} />
          <div className="ch"><h2 style={{ margin: 0 }}>{label(type)}</h2><span className={`pill ${off ? '' : 'ok'}`}>{off ? 'Off' : 'On'}</span></div>
          <div className="stack"><label className="fld"><span>Subject</span><input name="subject" defaultValue={o?.subject || d.subject} /></label><label className="fld"><span>Message</span><textarea name="line" rows={3} defaultValue={o?.line || d.line} /></label></div>
          <div className="actions" style={{ marginTop: 14 }}><label className="tg"><input type="checkbox" name="active" defaultChecked={o ? o.active : true} />Send this email</label><button className="btn">Save</button>{o && <button className="btn alt" name="do" value="reset">Reset</button>}</div>
        </form>); })}</div>
    </>
  );
}
