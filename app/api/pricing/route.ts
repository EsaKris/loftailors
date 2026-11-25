import { NextResponse } from 'next/server';
import { getPricing } from '@/lib/settings';
import { MAX_QTY } from '@/lib/pricing';
// Public: the numbers the cart shows. The server recomputes the same way when an order is placed.
export const dynamic = 'force-dynamic';
export async function GET() {
  const p = await getPricing();
  return NextResponse.json({ single: p.singleKobo / 100, pair: p.pairKobo / 100, gift: p.giftText, tiers: p.capTiers.map(t => ({ min: t.min, caps: t.caps })), maxQty: MAX_QTY }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
}
