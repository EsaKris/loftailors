import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SIZES, COLOURS, normalisePhone } from '@/lib/offers';
import { getPricing, getDeliveryKobo, getSetting } from '@/lib/settings';
import { computePricing, MAX_QTY } from '@/lib/pricing';
import { notify } from '@/lib/notify';
import { backupOrder } from '@/lib/sheets';
import { limited, ipOf } from '@/lib/ratelimit';
import { initTx } from '@/lib/paystack';
import { sendOrderEmail } from '@/lib/email';

export const maxDuration = 30;
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export async function POST(req: Request) {
  if (limited('checkout:' + ipOf(req), 30, 10 * 60_000)) return bad('Too many requests. Please wait a few minutes.', 429);
  let b: any;
  try { b = await req.json(); } catch { return bad('Invalid request'); }
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length < 1 || items.length > MAX_QTY) return bad(`Order between 1 and ${MAX_QTY} joggers`);
  if (items.some((i: any) => !SIZES.includes(i?.size) || !COLOURS.includes(i?.colour))) return bad('Choose a size and colour for every jogger');
  // The price is always computed here from the saved prices, never taken from the browser.
  const pr = computePricing(items.length, await getPricing());
  const offer = { qty: pr.qty, priceKobo: pr.subtotalKobo, free: pr.freeText };

  const c = b.customer || {};
  const name = clean(c.name, 120), phone = normalisePhone(clean(c.phone, 20)), email = clean(c.email, 160).toLowerCase();
  const address = clean(c.address, 300), city = clean(c.city, 80), state = clean(c.state, 40);
  if (name.length < 3 || !phone || address.length < 6 || !city || !state) return bad('Please complete your name, phone and delivery details');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return bad('Email address looks invalid');

  // Stock check for tracked variants only (variants you have not added to Inventory never block a sale).
  const want: Record<string, number> = {};
  items.forEach((i: any) => { const k = `${i.size}|${i.colour}`; want[k] = (want[k] || 0) + 1; });
  const { data: tracked } = await db.from('variant_stock').select('size, colour, stock');
  for (const t of tracked || []) { if ((want[`${t.size}|${t.colour}`] || 0) > t.stock) return bad(`Sorry, ${t.colour} size ${t.size} is not available in that quantity`); }

  const method = b.method === 'card' ? 'card' : 'whatsapp';
  if (method === 'whatsapp' && (await getSetting('whatsapp_orders', 'off')) !== 'on') return bad('Please pay by card to place your order');
  const fee = await getDeliveryKobo();
  if (method === 'card') {
    if (!process.env.PAYSTACK_SECRET_KEY || fee === null) return bad('Card payment is not available yet');
    if (!email) return bad('An email address is needed for card payment');
  }

  // Guest checkout: find the customer by normalised phone, otherwise create. (Uncertain matches are never auto-merged.)
  const { data: existing } = await db.from('customers').select('id, marketing_consent').eq('phone_e164', phone).maybeSingle();
  const consent = !!c.consent;
  const fields: any = { full_name: name, whatsapp_e164: phone, address, city, state, updated_at: new Date().toISOString() };
  if (email) fields.email = email;
  if (consent && !existing?.marketing_consent) Object.assign(fields, { marketing_consent: true, consent_at: new Date().toISOString(), consent_source: 'checkout' });
  let customerId = existing?.id as string | undefined;
  if (customerId) await db.from('customers').update(fields).eq('id', customerId);
  else {
    const { data: ins, error } = await db.from('customers').insert({ ...fields, phone_e164: phone }).select('id').single();
    if (error) return bad('Could not save your details', 500);
    customerId = ins.id;
  }

  const delivery = method === 'card' ? fee! : null;
  const total = offer.priceKobo + (delivery ?? 0);
  const session = typeof b.session === 'string' && /^[a-z0-9]{8,32}$/.test(b.session) ? b.session : null;
  const itemKey = (list: { size: string; colour: string }[]) => list.map(i => `${i.size}|${i.colour}`).sort().join(',');

  // Duplicate protection: if this same browser session already has an unpaid card order for this customer with the
  // same items and total (e.g. the first tap timed out and they tapped Pay Now again), reuse it instead of creating another.
  let order: { id: string; order_number: string; total_kobo: number } | null = null;
  let reused = false;
  if (method === 'card' && session) {
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data: cands } = await db.from('orders').select('id, order_number, total_kobo, order_items(size, colour)')
      .eq('customer_id', customerId).eq('session_id', session).eq('channel', 'card').eq('payment_status', 'pending')
      .eq('order_status', 'payment_pending').eq('total_kobo', total).gte('created_at', since).order('created_at', { ascending: false }).limit(3);
    const mine = itemKey(items);
    const hit = (cands || []).find((o: any) => itemKey(o.order_items || []) === mine);
    if (hit) { order = { id: hit.id, order_number: hit.order_number, total_kobo: hit.total_kobo }; reused = true; }
  }

  if (!order) {
    const { data: created, error: oe } = await db.from('orders').insert({
      customer_id: customerId, channel: method, pack_qty: offer.qty, subtotal_kobo: offer.priceKobo, delivery_kobo: delivery,
      total_kobo: total, free_items: offer.free || null,
      order_status: method === 'card' ? 'payment_pending' : 'new',
      delivery_address: address, city, state, customer_note: clean(c.note, 200) || null, session_id: session,
    }).select('id, order_number, total_kobo').single();
    if (oe || !created) { console.error('checkout: could not create order', oe?.message); return bad('Could not create your order', 500); }
    order = created;
    const { error: ie } = await db.from('order_items').insert(items.map((i: any) => ({ order_id: order!.id, size: i.size, colour: i.colour })));
    if (ie) console.error(`checkout ${order!.order_number}: could not save order items`, ie.message);
  }
  const o = order!;

  // Google Sheets backup, order email and the admin notification are not needed to take payment, so they run alongside
  // the Paystack call instead of before it. (Failed backups are retried by the daily reconcile job.)
  const side = reused ? Promise.resolve([]) : Promise.allSettled([
    backupOrder(o.id, 'ORDER_CREATED'),
    sendOrderEmail(o.id, 'order_received'),
    notify('order', `New order ${o.order_number}`, `${name} · ${offer.qty} joggers · ${method}`, `/admin/orders/${o.id}`, `order:${o.id}`),
  ]);
  // Give the side jobs a short window to finish, but never let them hold the customer up.
  const settleSide = () => Promise.race([side, new Promise(r => setTimeout(r, 2500))]);

  if (method === 'whatsapp') { await settleSide(); return NextResponse.json({ ok: true, orderNumber: o.order_number }); }

  try {
    const reference = `${o.order_number}-${Date.now().toString(36)}`;
    const tx = await initTx({ email, amountKobo: o.total_kobo, reference, callbackUrl: `${process.env.SITE_URL}/order/status`, metadata: { order_number: o.order_number } });
    const { error: pe } = await db.from('payments').insert({ order_id: o.id, reference, amount_kobo: o.total_kobo, currency: 'NGN' });
    if (pe) console.error(`checkout ${o.order_number}: payment row not saved for ${reference}`, pe.message);
    await settleSide();
    return NextResponse.json({ ok: true, orderNumber: o.order_number, url: tx.authorization_url });
  } catch (e: any) {
    console.error(`checkout ${o.order_number}: Paystack initialize failed:`, e?.message || e);
    return bad('Could not start card payment. Please try again or order on WhatsApp.', 502);
  }
}
