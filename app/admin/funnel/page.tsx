import Link from 'next/link';
import { db } from '@/lib/db';
import { requireSuper } from '@/lib/auth';
import { Head, Tile } from '@/components/ui';

const R: Record<string, [string, number | null]> = { '7': ['7 days', 7], '30': ['30 days', 30], all: ['All time', null] };
export default async function Funnel({ searchParams }: { searchParams: { r?: string } }) {
  await requireSuper();
  const key = R[searchParams.r || ''] ? searchParams.r! : '30', days = R[key][1];
  const from = days === null ? '1970-01-01' : new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await db.from('analytics_events').select('session,event').gte('created_at', from).limit(200000);
  const set = (e: string) => new Set((data || []).filter((x: any) => x.event === e).map((x: any) => x.session));
  const { data: paid } = await db.from('orders').select('session_id').eq('payment_status', 'successful').not('session_id', 'is', null).gte('paid_at', from);
  const steps: [string, number, string][] = [['Visited the page', set('view').size, '#6b4cff'], ['Added to cart', set('offer_click').size, '#8a6bff'], ['Clicked Pay', set('pay_click').size, '#ff8a4c'], ['Reached Paystack', set('pay_redirect').size, '#e8b84a'], ['Paid (verified)', new Set((paid || []).map((o: any) => o.session_id)).size, '#2fb783']];
  const top = Math.max(1, steps[0][1]), pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  return (
    <>
      <Head title="Conversion funnel" sub="How visitors move from the page to a paid order."><div className="seg">{Object.entries(R).map(([k, [l]]) => <Link key={k} className={k === key ? 'on' : ''} href={`/admin/funnel?r=${k}`}>{l}</Link>)}</div></Head>
      <div className="tiles"><Tile icon="users" cls="v" label="Visitors" value={steps[0][1]} /><Tile icon="funnel" cls="o" label="Overall conversion" value={pct(steps[4][1], steps[0][1])} /><Tile icon="wallet" cls="k" label="Paid" value={steps[4][1]} /><Tile icon="bell" cls="g" label="Lost at Paystack" value={pct(Math.max(0, steps[3][1] - steps[4][1]), steps[3][1])} hint="reached Paystack, did not pay" /></div>
      <div className="card"><div className="funnel">{steps.map(([l, n, c], i) => <div key={l} className="st" style={{ width: `${Math.max(34, (n / top) * 100)}%`, background: c }}><span>{l}</span><span>{n}{i > 0 && <small style={{ color: '#ffffffcc', marginLeft: 8 }}>{pct(n, steps[i - 1][1])}</small>}</span></div>)}</div></div>
      <p className="muted">Counts are anonymous visits in a browser tab (no cookies, no IP addresses). Someone who blocks scripts is not counted. Purchases are matched through the same random visit id once an order is paid.</p>
    </>
  );
}
