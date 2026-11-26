// How a cart is priced. Used by the server (what is charged) and mirrored by the storefront (what is shown).
//  - every 2 joggers cost the "pair price"; a leftover single costs the single price
//  - the free gift is SOCKS: socksPer pairs per jogger, but ONLY on orders of 1 or 2 joggers (none from 3 up; set in Admin > Offers & settings; 0 turns it off)
//  - free caps unlock by total quantity (tiers, e.g. 3+ = 1 cap, 5+ = 2 caps)
//  - listKobo is the "original price" shown struck out for marketing. It never changes what is charged.
export type CapTier = { min: number; caps: number; label: string };
export type PricingCfg = { singleKobo: number; pairKobo: number; giftText: string; capTiers: CapTier[]; socksPer: number; listKobo: number };
export const MAX_QTY = 20;
export const SOCKS_MAX_QTY = 2;   // socks are a gift for 1 or 2 joggers only. Keep in sync with SOCKS_MAX_QTY in site/index.template.html
export const DEFAULT_PRICING: PricingCfg = {
  singleKobo: 2_049_900, pairKobo: 3_899_900, giftText: '', socksPer: 1, listKobo: 0,
  capTiers: [{ min: 3, caps: 1, label: '1 free cap' }, { min: 5, caps: 2, label: '2 free caps' }],
};
export function computePricing(qty: number, cfg: PricingCfg) {
  const pairs = Math.floor(qty / 2), singles = qty % 2;
  const subtotalKobo = pairs * cfg.pairKobo + singles * cfg.singleKobo;
  const tier = [...cfg.capTiers].sort((a, b) => b.min - a.min).find(t => qty >= t.min);
  const caps = tier?.caps ?? 0, socks = qty <= SOCKS_MAX_QTY ? Math.max(0, cfg.socksPer) * qty : 0;
  const free: string[] = [];
  if (socks) free.push(`${socks} pair${socks > 1 ? 's' : ''} of socks`);
  if (caps) free.push(`${caps} free cap${caps > 1 ? 's' : ''}`);
  return { qty, pairs, singles, subtotalKobo, fullKobo: qty * cfg.singleKobo, savingsKobo: qty * cfg.singleKobo - subtotalKobo, gifts: 0, socks, caps, freeText: free.join(' + ') };
}
