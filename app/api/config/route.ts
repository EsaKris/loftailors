import { NextResponse } from 'next/server';
import { getDeliveryKobo, getSetting } from '@/lib/settings';
// Tells the storefront what it can offer: card (needs a Paystack key + a delivery fee) and WhatsApp ordering (off unless switched on in Settings).
export const dynamic = 'force-dynamic';
export async function GET() {
  const fee = await getDeliveryKobo(), hasKey = !!process.env.PAYSTACK_SECRET_KEY;
  return NextResponse.json({
    card: hasKey && fee !== null, reason: !hasKey ? 'no_paystack_key' : fee === null ? 'no_delivery_fee' : null,
    deliveryNaira: fee !== null ? fee / 100 : null, whatsapp: (await getSetting('whatsapp_orders', 'off')) === 'on',
  }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
}
