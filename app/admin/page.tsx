import Link from 'next/link';
import { db } from '@/lib/db';
import { requireAdmin, can } from '@/lib/auth';
import { naira } from '@/lib/offers';
import { pay, stat, label, lagos, greeting } from '@/lib/ui';
import { Icon } from '@/components/Nav';
import { Spark, AreaChart, Bars, Donut, short } from '@/components/charts';

const RANGES: Record<string, [string, number]> = { today: ['Today', 1], '7': ['7 days', 7], '30': ['30 days', 30], '90': ['90 days', 90] };
const DAY = 86400e3;
export default async function Overview({ searchParams }: { searchParams: { range?: string } }) {
  const admin = await requireAdmin();
  const su = admin.role === 'super';
  const key = RANGES[searchParams.range || ''] ? searchParams.range! : '30', N = RANGES[key][1], CN = Math.max(N, 7), now = Date.now();
  const dk = (ms: number) => new Date(ms + 3600e3).toISOString().slice(0, 10);   // Lagos date (UTC+1)
  const since = new Date(now - (2 * Math.max(N, 31) + 2) * DAY).toISOString();
  const count = async (f: (q: any) => any) => (await f(db.from('orders').select('id', { count: 'exact', head: true }))).count ?? 0;
  const newCust = async (a: number, b: number) => (await db.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', new Date(a).toISOString()).lt('created_at', new Date(b).toISOString())).count ?? 0;

  const [{ data: paidRaw }, { data: created }, { data: recent }, { data: vs }, pending, toProcess, toDispatch, abandoned, nc, np] = await Promise.all([
    db.from('orders').select('total_kobo,pack_qty,channel,paid_at').eq('payment_status', 'successful').gte('paid_at', since).limit(5000),
    db.from('orders').select('order_status').gte('created_at', new Date(now - CN * DAY).toISOString()).limit(5000),
    db.from('orders').select('id, order_number, total_kobo, payment_status, order_status, created_at, customers(full_name)').order('created_at', { ascending: false }).limit(7),
    db.from('variant_stock').select('stock,low_stock_at'),
    count(q => q.eq('payment_status', 'pending')), count(q => q.in('order_status', ['new', 'payment_confirmed', 'processing'])),
    count(q => q.eq('order_status', 'ready_for_dispatch')), count(q => q.eq('payment_status', 'abandoned')),
    newCust(now - N * DAY, now + 1), newCust(now - 2 * N * DAY, now - N * DAY),
  ]);
  const paid = paidRaw || [];
  const byDay = (f: (o: any) => number) => { const m: Record<string, number> = {}; paid.forEach((o: any) => { const k = dk(+new Date(o.paid_at)); m[k] = (m[k] || 0) + f(o); }); return m; };
  const rev = byDay(o => o.total_kobo), ord = byDay(() => 1), uni = byDay(o => o.pack_qty);
  const keys = (off: number, n = N) => Array.from({ length: n }, (_, i) => dk(now - (n - 1 - i + off * n) * DAY));
  const sum = (m: Record<string, number>, ks: string[]) => ks.reduce((s, k) => s + (m[k] || 0), 0);
  const cur = keys(0), prev = keys(1);
  const days = keys(0, CN), labels = days.map(d => `${+d.slice(8)} ${new Date(d + 'T00:00:00Z').toLocaleString('en', { month: 'short', timeZone: 'UTC' })}`);
  const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? { t: 'New', c: 'up' } : { t: '—', c: 'flat' }) : { t: `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`, c: a > b ? 'up' : a < b ? 'down' : 'flat' });
  const spark = (m: Record<string, number>) => days.slice(-14).map(d => m[d] || 0);
  const K = ({ icon, cls, l, v, d, sp, color, id }: any) => (
    <div className="card kpi2"><div className="kh"><span className={`ic ${cls}`}><Icon n={icon} size={20} /></span><span className={`delta ${d.c}`}>{d.t}</span></div><small>{l}</small><b>{v}</b>{sp && <Spark data={sp} color={color} id={id} />}</div>
  );

  const inWin = new Set(days), pw = paid.filter((o: any) => inWin.has(dk(+new Date(o.paid_at))));
  const byPack: Record<number, { n: number; v: number }> = {};
  pw.forEach((o: any) => { const bq = Math.min(5, o.pack_qty), x = byPack[bq] || (byPack[bq] = { n: 0, v: 0 }); x.n++; x.v += o.total_kobo; });
  const packMax = Math.max(1, ...Object.values(byPack).map(x => x.n));
  const grp = (s: string) => (['new', 'payment_pending'].includes(s) ? 0 : ['payment_confirmed', 'processing', 'ready_for_dispatch'].includes(s) ? 1 : s === 'dispatched' ? 2 : s === 'delivered' ? 3 : 4);
  const sc = [0, 0, 0, 0, 0]; (created || []).forEach((o: any) => sc[grp(o.order_status)]++);
  const parts = [['Awaiting payment', '#e8b84a'], ['Paid, in progress', '#6b4cff'], ['Dispatched', '#3b9cff'], ['Delivered', '#2fb783'], ['Cancelled / refunded', '#9a98a3']].map(([label, color], i) => ({ label, color, value: sc[i] }));
  const low = (vs || []).filter((v: any) => v.stock <= v.low_stock_at).length;

  const lg = new Date(now + 3600e3), y = lg.getUTCFullYear(), m = lg.getUTCMonth(), first = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`;
  const rem: [string, string, string, number, string][] = [
    ['To process', '/admin/orders?status=payment_confirmed', 'v', toProcess, 'bag'], ['Ready to dispatch', '/admin/orders?status=ready_for_dispatch', 'k', toDispatch, 'box'],
    ['Awaiting payment', '/admin/orders?status=payment_pending', 'g', pending, 'wallet'], ['Abandoned card checkouts', '/admin/orders', 'o', abandoned, 'funnel'], ['Low or out of stock', '/admin/inventory', 'o', low, 'bell'],
  ];
  return (
    <>
      <div className="pagehead welcome"><div><h1>{greeting()},<br />{admin.name.split(' ')[0]}</h1><p className="sub">Here is how LOFT is doing.</p></div>
        <div className="seg">{Object.entries(RANGES).map(([k, [l]]) => <Link key={k} className={k === key ? 'on' : ''} href={`/admin?range=${k}`}>{l}</Link>)}</div></div>
      <div className="kgrid">
        {su ? <K icon="wallet" cls="v" l="Verified revenue" v={naira(sum(rev, cur))} d={delta(sum(rev, cur), sum(rev, prev))} sp={spark(rev)} color="#6b4cff" id="r" /> : <K icon="bag" cls="v" l="Paid orders" v={sum(ord, cur)} d={delta(sum(ord, cur), sum(ord, prev))} sp={spark(ord)} color="#6b4cff" id="r" />}
        {su ? <K icon="bag" cls="o" l="Paid orders" v={sum(ord, cur)} d={delta(sum(ord, cur), sum(ord, prev))} sp={spark(ord)} color="#ff8a4c" id="o" /> : <K icon="wallet" cls="o" l="Awaiting payment" v={pending} d={{ t: '', c: 'flat' }} />}
        <K icon="box" cls="g" l="Joggers sold" v={sum(uni, cur)} d={delta(sum(uni, cur), sum(uni, prev))} sp={spark(uni)} color="#e8b84a" id="u" />
        <K icon="users" cls="k" l="New customers" v={nc} d={delta(nc, np)} />
      </div>
      <div className="dgrid">
        <div>
          <div className="card"><div className="ch"><div><h2>{su ? 'Verified revenue' : 'Paid orders'}</h2><small>Last {CN} days</small></div>{su && <Link href="/admin/reports" className="btn alt" style={{ minHeight: 34 }}>Reports</Link>}</div>
            <AreaChart id="main" labels={labels} data={days.map(d => (su ? rev[d] || 0 : ord[d] || 0))} fmt={su ? (n => '₦' + short(n / 100)) : (n => String(Math.round(n)))} /></div>
          <div className="two">
            <div className="card"><div className="ch"><div><h2>Orders by status</h2><small>Orders placed in the last {CN} days</small></div></div><Donut parts={parts} big={String(sc.reduce((a, b) => a + b, 0))} small="orders" /></div>
            <div className="card"><div className="ch"><div><h2>Joggers per order</h2><small>Paid orders, last {CN} days</small></div></div>
              <div className="prog">{[1, 2, 3, 4, 5].map((q, i) => { const x = byPack[q] || { n: 0, v: 0 }; return <div key={q}><div className="t"><span>{q === 5 ? '5 or more' : `${q} ${q > 1 ? 'joggers' : 'jogger'}`}</span><b>{x.n}{su ? ` · ${naira(x.v)}` : ''}</b></div><div className="bar"><i style={{ width: `${(x.n / packMax) * 100}%`, background: ['#6b4cff', '#ff8a4c', '#e8b84a', '#2fb783', '#3b9cff'][i] }} /></div></div>; })}</div></div>
          </div>
          <div className="card"><div className="ch"><div><h2>Joggers sold per day</h2><small>Last {CN} days</small></div></div><Bars labels={labels} data={days.map(d => uni[d] || 0)} /></div>
          <div><div className="ch"><h2 style={{ margin: 0 }}>Recent orders</h2><Link href="/admin/orders" className="btn alt" style={{ minHeight: 34 }}>All orders</Link></div>
            <div className="scroll"><table className="rt"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Placed</th></tr></thead><tbody>
              {(recent || []).map((o: any) => <tr key={o.id}><td data-label="Order"><Link href={`/admin/orders/${o.id}`}><b>{o.order_number}</b></Link></td><td data-label="Customer">{o.customers?.full_name}</td><td data-label="Total">{naira(o.total_kobo)}</td><td data-label="Payment"><span className={`pill ${pay(o.payment_status)}`}>{label(o.payment_status)}</span></td><td data-label="Status"><span className={`pill ${stat(o.order_status)}`}>{label(o.order_status)}</span></td><td data-label="Placed">{lagos(o.created_at)}</td></tr>)}
              {!recent?.length && <tr><td colSpan={6} className="empty">No orders yet. They appear here as soon as customers check out.</td></tr>}</tbody></table></div></div>
          {su && <p className="muted" style={{ margin: 0 }}>Revenue counts only payments verified with Paystack or confirmed by a Super Admin. It is not money in your bank yet; see Settlements.</p>}
        </div>
        <div className="rail">
          <div className="card me2"><div className="av2">{admin.name.slice(0, 1).toUpperCase()}</div><b style={{ fontSize: 17 }}>{admin.name}</b><br /><small>{su ? 'Super Admin' : 'Staff'}</small>
            <div className="qa"><Link className="btn" href="/admin/orders">Orders</Link>{can(admin, 'view_inventory') && <Link className="btn alt" href="/admin/inventory">Stock</Link>}<Link className="btn alt" href="/admin/templates">Templates</Link>{can(admin, 'view_customers') && <Link className="btn alt" href="/admin/followups">Follow-ups</Link>}</div></div>
          <div className="card"><h2>Needs attention</h2><div className="rem">{rem.map(([l, href, c, n, ic]) => <Link key={l} href={href}><span className={`ri ic ${c}`}><Icon n={ic} /></span><span className="rt2"><b style={{ fontWeight: 600 }}>{l}</b></span><span className="n">{n}</span></Link>)}</div></div>
          <div className="card"><div className="ch"><h2 style={{ margin: 0 }}>{new Date(Date.UTC(y, m, 1)).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><small>Dots = days with paid orders</small></div>
            <div className="cal">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="h">{d}</span>)}
              {Array.from({ length: first }, (_, i) => <span key={'e' + i} />)}
              {Array.from({ length: dim }, (_, i) => { const d = i + 1, k = prefix + String(d).padStart(2, '0'); return <span key={d} className={`${d === lg.getUTCDate() ? 'today' : ''}${ord[k] ? ' has' : ''}`} title={ord[k] ? `${ord[k]} paid order(s)` : undefined}>{d}</span>; })}</div></div>
        </div>
      </div>
    </>
  );
}
