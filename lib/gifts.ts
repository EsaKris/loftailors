import { db } from './db';
import { getPricing } from './settings';
import { computePricing } from './pricing';
import { notify } from './notify';
// Takes the free socks and caps of a paid order out of the gift stock (Admin > Inventory > Free gifts).
// Safe to call many times (one movement per order and item). Never throws, so it can never block a payment.
export async function deductGifts(orderId: string) {
  try {
    const { data: o } = await db.from('orders').select('pack_qty').eq('id', orderId).maybeSingle();
    if (!o?.pack_qty) return;
    const pr = computePricing(o.pack_qty, await getPricing());
    await db.rpc('deduct_gifts', { p_order: orderId, p_socks: pr.socks, p_caps: pr.caps });
    const { data: gs } = await db.from('gift_stock').select('item,label,stock,low_stock_at');
    for (const g of gs || []) if (g.stock <= g.low_stock_at) await notify('stock', `${g.stock <= 0 ? 'Out of stock' : 'Low stock'}: ${g.label}`, `${g.stock} left`, '/admin/inventory', `low-gift:${g.item}:${g.stock}`);
  } catch (e) { console.error('deductGifts', e); }
}
