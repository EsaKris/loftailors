import { db } from '@/lib/db';
import { requireSuper } from '@/lib/auth';
import { sheetsEnabled } from '@/lib/sheets';
import { getDeliveryKobo } from '@/lib/settings';
import { Head, Flash } from '@/components/ui';

export default async function Settings({ searchParams }: { searchParams: { msg?: string } }) {
  await requireSuper();
  const { data: offers } = await db.from('offers').select('*').order('q');
  const { data: st } = await db.from('settings').select('*');
  const { data: bl } = await db.from('backup_log').select('status').limit(20000);
  const bn = (x: string) => (bl || []).filter((r: any) => r.status === x).length;
  const fee = await getDeliveryKobo();
  const s = Object.fromEntries((st || []).map((x: any) => [x.key, x.value]));
  const checks: [string, boolean, string][] = [
    ['Paystack secret key', !!process.env.PAYSTACK_SECRET_KEY, 'Add PAYSTACK_SECRET_KEY to your environment and restart'],
    ['Delivery fee for card orders', fee !== null, 'Set it in Store settings below'],
    ['Site address (SITE_URL)', !!process.env.SITE_URL, 'Paystack uses it to send customers back to your site'],
    ['Email sending (Resend)', !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM, 'Optional: order emails stay off without it'],
    ['Email delivery webhook', !!process.env.RESEND_WEBHOOK_SECRET, 'Optional'],
    ['Google Sheets backup', sheetsEnabled(), 'Add the Google service account credentials and spreadsheet ID'],
    ['Daily recovery job (CRON_SECRET)', !!process.env.CRON_SECRET, 'Needed once deployed'],
  ];
  const ready = checks.slice(0, 2).every(c => c[1]);
  return (
    <>
      <Head title="Offers & settings" sub="Prices here are what the storefront shows and what customers are charged." />
      <Flash msg={searchParams.msg} />
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="ch"><div><h2>Setup status</h2><small>The card button works when the first two lines are ready.</small></div><span className={`pill ${ready ? 'ok' : 'warn'}`}>{ready ? 'Card payment ready' : 'Setup needed'}</span></div>
        <div className="stack">{checks.map(([l, ok, hint]) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><span>{l}{!ok && <small> · {hint}</small>}</span><span className={`pill ${ok ? 'ok' : 'warn'}`}>{ok ? 'Ready' : 'Not set'}</span></div>)}</div></div>
      <h2>Pricing</h2>
      <p className="muted" style={{ marginTop: 0 }}>Customers add joggers to a cart. Every 2 joggers cost the pair price and earn a free gift; a leftover single costs the single price. Free caps unlock by total quantity. Example: 3 joggers = pair + single, 1 free gift and 1 free cap.</p>
      <div className="grid2">{(offers || []).map((o: any) => (
        <form key={o.q} className="card" method="post" action="/api/admin/settings"><input type="hidden" name="do" value="offer" /><input type="hidden" name="q" value={o.q} /><input type="hidden" name="label" value={o.label} /><input type="hidden" name="tag" value={o.tag} />
          <div className="ch"><h2 style={{ margin: 0 }}>{o.q === 1 ? 'Single jogger' : o.q === 2 ? 'Pair deal (every 2 joggers)' : `Free caps from ${o.q} joggers`}</h2><label className="tg"><input type="checkbox" name="active" defaultChecked={o.active} />Active</label></div>
          <div className="stack">
            {o.q <= 2 ? <label className="fld"><span>{o.q === 1 ? 'Price of one jogger (₦)' : 'Price of a pair (₦)'}</span><input name="price" type="number" min="1" step="1" defaultValue={Number(o.price_kobo) / 100} /></label> : <input type="hidden" name="price" value={Number(o.price_kobo) / 100} />}
            {o.q === 2 && <label className="fld"><span>Free gift with every pair (leave the exact gift here once confirmed)</span><input name="free_text" defaultValue={o.free_text} /></label>}
            {o.q >= 3 && <label className="fld"><span>Free caps at this quantity</span><input name="caps" type="number" min="0" max="10" defaultValue={o.caps ?? (o.q === 3 ? 1 : o.q === 5 ? 2 : 0)} /></label>}
            {o.q >= 3 && <input type="hidden" name="free_text" value={o.free_text} />}
            {o.q < 3 && <input type="hidden" name="caps" value="0" />}</div>
          <button className="btn mt">Save</button>
        </form>))}</div>
      <div className="grid2 mt">
        <form className="card" method="post" action="/api/admin/settings"><h2>Store settings</h2><input type="hidden" name="do" value="settings" />
          <div className="stack">
            <label className="tg" style={{ justifySelf: 'start' }}><input type="checkbox" name="whatsapp_orders" defaultChecked={s.whatsapp_orders === 'on'} />Allow orders sent through WhatsApp</label>
            <label className="fld"><span>Delivery fee for card orders (₦). Empty turns card payment off.</span><input name="delivery_fee_naira" defaultValue={s.delivery_fee_naira} inputMode="decimal" /></label>
            <label className="fld"><span>High-value customer from (₦)</span><input name="high_value_naira" defaultValue={s.high_value_naira} inputMode="numeric" /></label>
            <label className="fld"><span>Inactive customer after (days)</span><input name="inactive_days" defaultValue={s.inactive_days} inputMode="numeric" /></label>
            <label className="fld"><span>Follow up after delivery (days)</span><input name="followup_days" defaultValue={s.followup_days} inputMode="numeric" /></label></div>
          <button className="btn mt">Save settings</button></form>
        <div className="card"><div className="ch"><h2 style={{ margin: 0 }}>Google Sheets backup</h2><span className={`pill ${sheetsEnabled() ? 'ok' : ''}`}>{sheetsEnabled() ? 'On' : 'Off'}</span></div>
          <p className="muted" style={{ marginTop: 0 }}>Every order is saved to your private Google Sheet when created. The same row is updated when payment is verified.</p>
          <div className="fgrid" style={{ marginBottom: 14 }}><div className="card" style={{ padding: 14, boxShadow: 'none', background: 'var(--soft)' }}><small>Sent</small><br /><b style={{ fontSize: 22 }}>{bn('sent')}</b></div><div className="card" style={{ padding: 14, boxShadow: 'none', background: 'var(--soft)' }}><small>Failed</small><br /><b style={{ fontSize: 22 }}>{bn('failed')}</b></div><div className="card" style={{ padding: 14, boxShadow: 'none', background: 'var(--soft)' }}><small>Waiting</small><br /><b style={{ fontSize: 22 }}>{bn('queued')}</b></div></div>
          <form method="post" action="/api/admin/backup" className="actions"><button className="btn alt" name="do" value="test">Send test entry</button><button className="btn alt" name="do" value="retry">Retry failed</button></form>
          <p className="muted" style={{ marginBottom: 0 }}>The test writes a TEST-ENTRY row directly into your spreadsheet. You can safely delete it after confirming the connection.</p></div>
      </div>
    </>
  );
}
