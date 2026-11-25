// Single source of truth for prices. The server always recomputes totals from here,
// never from what the browser sends. Amounts are in kobo.
export const OFFERS: Record<number, { qty: number; priceKobo: number; free: string }> = {
  1: { qty: 1, priceKobo: 2_049_900, free: '' },
  2: { qty: 2, priceKobo: 3_899_900, free: 'A free gift (LOFT confirms which)' },
  3: { qty: 3, priceKobo: 3 * 2_049_900, free: '1 free cap' },   // 3 x regular price: confirm with LOFT
  5: { qty: 5, priceKobo: 5 * 2_049_900, free: '2 free caps' },  // 5 x regular price: confirm with LOFT
};
export const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
export const COLOURS = ['Black', 'Charcoal', 'Navy', 'Olive', 'Grey', 'Cream'];
export const naira = (kobo: number) => '₦' + (kobo / 100).toLocaleString('en-NG');
export const deliveryKobo = (): number | null => {
  const v = process.env.DELIVERY_FEE_NAIRA;
  return v && !isNaN(Number(v)) ? Math.round(Number(v) * 100) : null;
};
// Normalise Nigerian numbers to +234XXXXXXXXXX. Returns null if it does not look valid.
export function normalisePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (/^0\d{10}$/.test(d)) return '+234' + d.slice(1);
  if (/^234\d{10}$/.test(d)) return '+' + d;
  return null;
}
export const waLink = (phoneE164: string, text: string) => `https://wa.me/${phoneE164.replace('+', '')}?text=${encodeURIComponent(text)}`;
