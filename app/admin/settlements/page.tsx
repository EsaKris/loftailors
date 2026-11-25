import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { naira } from '@/lib/offers';
import { Head, Tile, Flash, Empty } from '@/components/ui';

export default async function Settlements({ searchParams }: { searchParams: { from?: string; to?: string; msg?: string } }) {
  const a = await requireAdmin();
  if (a.role !== 'super') redirect('/admin');
  const d = new Date(); const to = searchParams.to || d.toISOString().slice(0, 10); d.setDate(d.getDate() - 30); const from = searchParams.from || d.toISOString().slice(0, 10);
  const end = to + 'T23:59:59Z';
  const [{ data: pays }, { data: refs }, { data: sets }] = await Promise.all([
    db.from('payments').select('amount_kobo,fees_kobo').eq('status', 'successful').eq('provider', 'paystack').gte('paid_at', from).lte('paid_at', end),
    db.from('refunds').select('amount_kobo').eq('status', 'processed').gte('processed_at', from).lte('processed_at', end),
    db.from('settlements').select('*').gte('settlement_date', from).lte('settlement_date', end).order('settlement_date', { ascending: false }),
  ]);
  const sum = (r: any[] | null, k: string) => (r || []).reduce((s, x) => s + (x[k] || 0), 0);
  const gross = sum(pays, 'amount_kobo'), fees = sum(pays, 'fees_kobo'), refunds = sum(refs, 'amount_kobo'), settled = sum(sets, 'effective_amount_kobo');
  const expected = gross - fees - refunds, diff = settled - expected;
  return (
    <>
      <Head title="Settlements & exports" sub="Compare what customers paid with what Paystack settled to you.">
        <form method="post" action="/api/admin/settlements"><button className="btn">Sync from Paystack</button></form></Head>
      <Flash msg={searchParams.msg} />
      <form className="actions" style={{ marginBottom: 16 }}><label className="fld"><span>From</span><input type="date" name="from" defaultValue={from} /></label><label className="fld"><span>To</span><input type="date" name="to" defaultValue={to} /></label><button className="btn alt" style={{ alignSelf: 'end' }}>Apply</button></form>
      <div className="tiles">
        <Tile icon="wallet" cls="v" label="Card payments verified" value={naira(gross)} /><Tile icon="chart" cls="o" label="Paystack fees" value={naira(fees)} /><Tile icon="bell" cls="g" label="Refunds processed" value={naira(refunds)} />
        <Tile icon="funnel" cls="k" label="Expected net" value={naira(expected)} /><Tile icon="box" cls="v" label="Settled by Paystack" value={naira(settled)} /><Tile icon="shield" cls={diff === 0 ? 'k' : 'o'} label="Difference" value={naira(diff)} hint={diff === 0 ? 'Matches' : 'Check the dates'} /></div>
      <p className="muted">Settlements arrive a day or more after payments, so differences near the edges of a range are normal. This compares against Paystack&apos;s own records, not your bank statement.</p>
      <h2>Settlements</h2>
      <div className="scroll"><table className="rt"><thead><tr><th>Date</th><th>Status</th><th>Amount settled</th><th>Fees</th></tr></thead><tbody>
        {(sets || []).map((s: any) => <tr key={s.id}><td data-label="Date">{s.settlement_date ? new Date(s.settlement_date).toLocaleDateString('en-NG') : ''}</td><td data-label="Status"><span className="pill">{s.status}</span></td><td data-label="Settled">{naira(s.effective_amount_kobo || 0)}</td><td data-label="Fees">{s.fees_kobo == null ? '' : naira(s.fees_kobo)}</td></tr>)}
        {!sets?.length && <tr><td colSpan={4}><Empty icon="wallet" title="No settlements synced for this range" text="Press Sync from Paystack." /></td></tr>}</tbody></table></div>
      <h2 className="mt">Exports</h2>
      <div className="grid2">{['orders', 'customers', 'payments'].map(t => <div key={t} className="card"><h2 style={{ textTransform: 'capitalize' }}>{t}</h2><p className="muted" style={{ marginTop: 0 }}>{from} to {to}</p><div className="actions">{['csv', 'xlsx', 'pdf'].map(f => <a key={f} className="btn alt" href={`/api/admin/export?type=${t}&format=${f}&from=${from}&to=${to}`}>{f === 'xlsx' ? 'Excel' : f.toUpperCase()}</a>)}</div></div>)}</div>
    </>
  );
}
