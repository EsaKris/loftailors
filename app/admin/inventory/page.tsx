import { db } from '@/lib/db';
import { requireCan } from '@/lib/auth';
import { SIZES, COLOURS } from '@/lib/offers';
import { Head, Tile, Flash } from '@/components/ui';

export default async function Inventory() {
  const a = await requireCan('view_inventory');
  const { data } = await db.from('variant_stock').select('*');
  const get = (c: string, s: string) => (data || []).find((v: any) => v.colour === c && v.size === s);
  const out = (data || []).filter((v: any) => v.stock <= 0).length, low = (data || []).filter((v: any) => v.stock > 0 && v.stock <= v.low_stock_at).length;
  const total = (data || []).reduce((s: number, v: any) => s + Math.max(0, v.stock), 0);
  return (
    <>
      <Head title="Inventory" sub="Stock by colour and size. Paid joggers reduce it automatically." />
      <div className="tiles"><Tile icon="box" cls="v" label="Joggers in stock" value={total} /><Tile icon="bell" cls="g" label="Low stock" value={low} /><Tile icon="shield" cls="o" label="Out of stock" value={out} /><Tile icon="grid" cls="k" label="Tracked combinations" value={data?.length ?? 0} /></div>
      <div className="two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        <div className="card" style={{ overflowX: 'auto' }}><h2>Stock grid</h2>
          <table className="mat"><thead><tr><th />{SIZES.map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>
            {COLOURS.map(c => <tr key={c}><td className="rl">{c}</td>{SIZES.map(s => { const v = get(c, s); const k = !v ? '' : v.stock <= 0 ? 'bad' : v.stock <= v.low_stock_at ? 'warn' : 'ok'; return <td key={s}><div className={`cell ${k}`} title={v ? `${v.stock} in stock` : 'Not tracked'}>{v ? v.stock : '–'}</div></td>; })}</tr>)}</tbody></table>
          <p className="muted" style={{ marginBottom: 0 }}>A dash means that combination is not tracked and never blocks a sale. Tracked combinations are blocked at checkout when they reach 0.</p></div>
        {a.role === 'super' ? <form className="card" method="post" action="/api/admin/inventory"><h2>Update stock</h2>
          <div className="stack"><label className="fld"><span>Colour</span><select name="colour">{COLOURS.map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="fld"><span>Size</span><select name="size">{SIZES.map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="fld"><span>Quantity (use − to remove)</span><input name="delta" type="number" placeholder="e.g. 20 or -2" required /></label>
            <label className="fld"><span>Note (optional)</span><input name="note" placeholder="e.g. new delivery" /></label></div>
          <button className="btn mt" style={{ width: '100%' }}>Update stock</button></form>
          : <div className="card"><h2>View only</h2><p className="muted">Only a Super Admin can change stock.</p></div>}
      </div>
    </>
  );
}
