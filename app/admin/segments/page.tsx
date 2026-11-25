import Link from 'next/link';
import { db } from '@/lib/db';
import { requireCan } from '@/lib/auth';
import { naira } from '@/lib/offers';
import { getSetting } from '@/lib/settings';
import { Head, Tile, Empty } from '@/components/ui';

export default async function Segments({ searchParams }: { searchParams: { s?: string } }) {
  await requireCan('view_customers');
  const hv = (parseInt(await getSetting('high_value_naira', '100000'), 10) || 100000) * 100, inactiveDays = parseInt(await getSetting('inactive_days', '60'), 10) || 60;
  const { data: cs } = await db.from('customers').select('*').limit(3000);
  const { data: os } = await db.from('orders').select('customer_id,total_kobo,paid_at').eq('payment_status', 'successful').limit(20000);
  const now = Date.now(), DAY = 86400000;
  const info = new Map<string, { n: number; spent: number; last: number }>();
  (os || []).forEach((o: any) => { const x = info.get(o.customer_id) || { n: 0, spent: 0, last: 0 }; x.n++; x.spent += o.total_kobo; x.last = Math.max(x.last, +new Date(o.paid_at || 0)); info.set(o.customer_id, x); });
  const g = (id: string) => info.get(id) || { n: 0, spent: 0, last: 0 };
  const SEG: Record<string, [string, string, string, (c: any) => boolean]> = {
    first: ['First-time buyers', 'users', 'v', c => g(c.id).n === 1], repeat: ['Repeat customers', 'heart', 'k', c => g(c.id).n > 1],
    high: [`High-value (≥ ${naira(hv)})`, 'wallet', 'g', c => g(c.id).spent >= hv], inactive: [`Inactive ${inactiveDays}+ days`, 'bell', 'o', c => g(c.id).n > 0 && now - g(c.id).last > inactiveDays * DAY],
    recent: ['Bought in last 30 days', 'bag', 'v', c => g(c.id).n > 0 && now - g(c.id).last <= 30 * DAY], optin: ['Opted in to marketing', 'mega', 'k', c => c.marketing_consent], optout: ['Not opted in', 'shield', 'o', c => !c.marketing_consent],
  };
  const key = SEG[searchParams.s || ''] ? searchParams.s! : '';
  const list = key ? (cs || []).filter(SEG[key][3]) : [];
  return (
    <>
      <Head title="Customer segments" sub="Pick a group to see who is in it. Spend counts verified payments only; thresholds are in Offers & settings." />
      <div className="tiles">{Object.entries(SEG).map(([k, [l, ic, c, fn]]) => <Tile key={k} icon={ic} cls={c} label={l} value={(cs || []).filter(fn).length} href={`/admin/segments?s=${k}`} sel={k === key} />)}</div>
      {key && <><h2>{SEG[key][0]}</h2>
        <div className="scroll"><table className="rt"><thead><tr><th>Name</th><th>Phone</th><th>Paid orders</th><th>Verified spend</th><th>Marketing</th><th /></tr></thead><tbody>
          {list.map((c: any) => <tr key={c.id}><td data-label="Name"><Link href={`/admin/customers/${c.id}`}><b>{c.full_name}</b></Link></td><td data-label="Phone">{c.phone_e164}</td><td data-label="Paid orders">{g(c.id).n}</td><td data-label="Spend">{naira(g(c.id).spent)}</td><td data-label="Marketing">{c.marketing_consent ? <span className="pill ok">Opted in</span> : <span className="pill">No</span>}</td><td data-label=""><a className="btn wa" style={{ minHeight: 36 }} target="_blank" rel="noopener noreferrer" href={`/api/admin/wa?c=${c.id}`}>WhatsApp</a></td></tr>)}
          {!list.length && <tr><td colSpan={6}><Empty icon="users" title="No customers in this group yet" /></td></tr>}</tbody></table></div>
        <p className="muted">Only message customers who have opted in for promotions.</p></>}
    </>
  );
}
