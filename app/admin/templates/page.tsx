import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { Head } from '@/components/ui';

const CAT: Record<string, [string, string]> = { order: ['Order', 'info'], followup: ['Follow-up', 'ok'], promo: ['Promotional', 'warn'] };
export default async function Templates() {
  const a = await requireAdmin();
  const { data } = await db.from('whatsapp_templates').select('*').order('sort');
  const canEdit = a.role === 'super';
  const F = ({ t }: { t?: any }) => (
    <form className="card" method="post" action="/api/admin/templates"><input type="hidden" name="id" value={t?.id || ''} />
      <div className="ch"><h2 style={{ margin: 0 }}>{t ? t.name : 'New template'}</h2>{t && <span className={`pill ${CAT[t.category]?.[1]}`}>{CAT[t.category]?.[0]}</span>}</div>
      <div className="fgrid"><label className="fld"><span>Name</span><input name="name" defaultValue={t?.name} required disabled={!canEdit} /></label>
        <label className="fld"><span>Type</span><select name="category" defaultValue={t?.category || 'order'} disabled={!canEdit}><option value="order">Order</option><option value="followup">Follow-up</option><option value="promo">Promotional</option></select></label></div>
      <label className="fld" style={{ marginTop: 12 }}><span>Message</span><textarea name="body" rows={4} defaultValue={t?.body} required disabled={!canEdit} /></label>
      {canEdit && <div className="actions" style={{ marginTop: 14 }}><button className="btn">{t ? 'Save' : 'Add template'}</button>{t && <button className="btn alt" name="do" value="delete">Delete</button>}</div>}
    </form>);
  return (
    <>
      <Head title="WhatsApp templates" sub="Messages open in WhatsApp for you to review and send. Nothing is sent automatically." />
      <div className="card" style={{ marginBottom: 18 }}><b>Placeholders</b><p className="muted" style={{ margin: '6px 0 0' }}>{'{{customer_name}}  {{order_number}}  {{order_amount}}  {{payment_status}}  {{delivery_status}}  {{delivery_address}}  {{product_name}}  {{tracking_info}}'}<br />Promotional templates are blocked for customers who have not opted in.</p></div>
      <div className="grid2">{(data || []).map((t: any) => <F key={t.id} t={t} />)}{canEdit && <F />}</div>
    </>
  );
}
