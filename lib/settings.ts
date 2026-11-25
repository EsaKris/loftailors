import { db } from './db';
import { OFFERS as DEFAULTS } from './offers';
import { DEFAULT_PRICING, type PricingCfg } from './pricing';
export async function getSetting(key: string, fallback = ''): Promise<string> {
  const { data } = await db.from('settings').select('value').eq('key', key).maybeSingle();
  return data?.value || fallback;
}
// Delivery fee for card payments: set in Settings, falling back to the env var. null = card payment stays off.
export async function getDeliveryKobo(): Promise<number | null> {
  const v = await getSetting('delivery_fee_naira', process.env.DELIVERY_FEE_NAIRA || '');
  return v && !isNaN(Number(v)) && Number(v) >= 0 ? Math.round(Number(v) * 100) : null;
}
export type OfferMap = Record<number, { qty: number; priceKobo: number; free: string; label?: string; tag?: string; cap?: boolean }>;
export async function getOffers(): Promise<OfferMap> {
  const { data } = await db.from('offers').select('*').eq('active', true);
  const now = Date.now(), m: OfferMap = {};
  for (const o of data || []) {
    if (o.starts_at && +new Date(o.starts_at) > now) continue;
    if (o.ends_at && +new Date(o.ends_at) < now) continue;
    m[o.q] = { qty: o.q, priceKobo: Number(o.price_kobo), free: o.free_text || '', label: o.label || '', tag: o.tag || '', cap: !!o.cap };
  }
  return Object.keys(m).length ? m : DEFAULTS;
}

// Pricing used by the cart: row 1 = single price, row 2 = pair price + gift, rows 3+ = free-cap tiers (min quantity, caps).
export async function getPricing(): Promise<PricingCfg> {
  const { data } = await db.from('offers').select('*').eq('active', true);
  const rows = data || [];
  if (!rows.length) return DEFAULT_PRICING;
  const r1 = rows.find((r: any) => r.q === 1), r2 = rows.find((r: any) => r.q === 2);
  const single = r1 ? Number(r1.price_kobo) : DEFAULT_PRICING.singleKobo;
  const tiers = rows.filter((r: any) => r.q >= 3).map((r: any) => ({ min: r.q, caps: r.caps ?? (r.q === 3 ? 1 : r.q === 5 ? 2 : 0), label: r.free_text || '' })).filter((t: any) => t.caps > 0);
  return { singleKobo: single, pairKobo: r2 ? Number(r2.price_kobo) : 2 * single, giftText: r2 ? r2.free_text || '' : '', capTiers: tiers };
}
