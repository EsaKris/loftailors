import { db } from '@/lib/db';
import { requireSuper } from '@/lib/auth';
import { naira } from '@/lib/offers';
import { AreaChart, Bars, Donut, short } from '@/components/charts';
import { Head, Tile } from '@/components/ui';

const DAY = 86400e3;
export default async function Reports() {
  await requireSuper();
  const now = Date.now(), dk = (ms: number) => new Date(ms + 3600e3).toISOString().slice(0, 10);
  const { data } = await db.from('orders').select('total_kobo,pack_qty,channel,state,paid_at').eq('payment_status', 'successful').gte('paid_at', new Date(now - 70 * DAY).toISOString()).limit(5000);
  const rows = (data || []).map((o: any) => ({ ...o, d: dk(+new Date(o.paid_at)) }));
  const ym = dk(now).slice(0, 7), prev = dk(Date.UTC(new Date(now + 3600e3).getUTCFullYear(), new Date(now + 3600e3).getUTCMonth() - 1, 15)).slice(0, 7);
  const sum = (f: (r: any) => boolean) => rows.filter(f).reduce((s: number, r: any) => s + r.total_kobo, 0), cnt = (f: (r: any) => boolean) => rows.filter(f).length;
  const cur = sum(r => r.d.startsWith(ym)), last = sum(r => r.d.startsWith(prev)), pct = last ? Math.round(((cur - last) / last) * 100) : null;
  const days = Array.from({ length: 30 }, (_, i) => dk(now - (29 - i) * DAY)), labels = days.map(d => `${+d.slice(8)}/${+d.slice(5, 7)}`);
  const rev = days.map(d => sum(r => r.d === d)), ord = days.map(d => cnt(r => r.d === d));
  const win = rows.filter((r: any) => days.includes(r.d));
  const byPack = [1, 2, 3, 4, 5].map((q, i) => ({ label: q === 5 ? '5 or more' : `${q} ${q > 1 ? 'joggers' : 'jogger'}`, value: win.filter((r: any) => (q === 5 ? r.pack_qty >= 5 : r.pack_qty === q)).length, color: ['#6b4cff', '#ff8a4c', '#e8b84a', '#2fb783', '#3b9cff'][i] }));
  const ch = ['card', 'whatsapp'].map((c, i) => ({ label: c === 'card' ? 'Card' : 'WhatsApp', value: win.filter((r: any) => r.channel === c).length, color: ['#6b4cff', '#2fb783'][i] }));
  const st: Record<string, number> = {}; win.forEach((r: any) => { if (r.state) st[r.state] = (st[r.state] || 0) + 1; });
  const top = Object.entries(st).sort((a, b) => b[1] - a[1]).slice(0, 5), topMax = Math.max(1, ...top.map(t => t[1]));
  return (
    <>
      <Head title="Reports" sub="Verified payments only. This is not money in your bank; see Settlements for that." />
      <div className="tiles"><Tile icon="wallet" cls="v" label="This month" value={naira(cur)} /><Tile icon="chart" cls="o" label="Last month" value={naira(last)} /><Tile icon="funnel" cls="k" label="Change" value={pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`} /><Tile icon="bag" cls="g" label="Paid orders (30 days)" value={win.length} /></div>
      <div className="card"><div className="ch"><div><h2>Verified revenue</h2><small>Last 30 days</small></div></div><AreaChart id="rp" labels={labels} data={rev} fmt={n => '₦' + short(n / 100)} /></div>
      <div className="grid2 mt">
        <div className="card"><div className="ch"><div><h2>Orders per day</h2><small>Last 30 days</small></div></div><Bars labels={labels} data={ord} color="#ff8a4c" /></div>
        <div className="card"><div className="ch"><div><h2>Joggers per order</h2><small>Share of paid orders</small></div></div><Donut parts={byPack} big={String(win.length)} small="orders" /></div>
        <div className="card"><div className="ch"><div><h2>How customers paid</h2><small>Card or WhatsApp</small></div></div><Donut parts={ch} big={String(win.length)} small="orders" /></div>
        <div className="card"><div className="ch"><div><h2>Top states</h2><small>By paid orders</small></div></div>
          <div className="prog">{top.map(([s, n]) => <div key={s}><div className="t"><span>{s}</span><b>{n}</b></div><div className="bar"><i style={{ width: `${(n / topMax) * 100}%`, background: '#6b4cff' }} /></div></div>)}{!top.length && <p className="muted">No paid orders yet.</p>}</div></div>
      </div>
    </>
  );
}
