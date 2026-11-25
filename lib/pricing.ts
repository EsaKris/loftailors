// How a cart is priced. Used by the server (what is charged) and mirrored by the storefront (what is shown).
//  - every 2 joggers cost the "pair price" and earn one free gift; a leftover single costs the single price
//  - free caps unlock by total quantity (tiers, e.g. 3+ = 1 cap, 5+ = 2 caps)
export type CapTier = { min: number; caps: number; label: string };
export type PricingCfg = { singleKobo: number; pairKobo: number; giftText: string; capTiers: CapTier[] };
export const MAX_QTY = 20;
export const DEFAULT_PRICING: PricingCfg = {
  singleKobo: 2_049_900, pairKobo: 3_899_900, giftText: 'A free gift (LOFT confirms which)',
  capTiers: [{ min: 3, caps: 1, label: '1 free cap' }, { min: 5, caps: 2, label: '2 free caps' }],
};
export function computePricing(qty: number, cfg: PricingCfg) {
  const pairs = Math.floor(qty / 2), singles = qty % 2;
  const subtotalKobo = pairs * cfg.pairKobo + singles * cfg.singleKobo;
  const tier = [...cfg.capTiers].sort((a, b) => b.min - a.min).find(t => qty >= t.min);
  const caps = tier?.caps ?? 0, gifts = cfg.giftText ? pairs : 0;
  const free: string[] = [];
  if (gifts) free.push(gifts === 1 ? cfg.giftText : `${gifts} × ${cfg.giftText}`);
  if (caps) free.push(`${caps} free cap${caps > 1 ? 's' : ''}`);
  return { qty, pairs, singles, subtotalKobo, fullKobo: qty * cfg.singleKobo, savingsKobo: qty * cfg.singleKobo - subtotalKobo, gifts, caps, freeText: free.join(' + ') };
}
