import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin, can } from '@/lib/auth';
import { waLink } from '@/lib/offers';
import { fill, varsFor } from '@/lib/templates';
// Opens WhatsApp with a filled-in message and logs that it was OPENED. We cannot know if it was actually sent.
export async function GET(req: Request) {
  const a = await getAdmin();
  if (!a) return new NextResponse('Unauthorised', { status: 401 });
  if (!can(a, 'whatsapp')) return new NextResponse('No permission', { status: 403 });
  const u = new URL(req.url).searchParams;
  const { data: c } = await db.from('customers').select('*').eq('id', u.get('c') || '').maybeSingle();
  if (!c) return new NextResponse('Customer not found', { status: 404 });
  const { data: o } = u.get('o') ? await db.from('orders').select('*').eq('id', u.get('o')!).maybeSingle() : { data: null };
  const { data: t } = u.get('t') ? await db.from('whatsapp_templates').select('*').eq('id', u.get('t')!).maybeSingle() : { data: null };
  if (t?.category === 'promo' && !c.marketing_consent) return new NextResponse('This customer has not opted in to promotional messages.', { status: 403 });
  const text = t ? fill(t.body, varsFor(c, o)) : `Hello ${c.full_name.split(' ')[0]}, this is LOFT. `;
  await db.from('communication_logs').insert({ customer_id: c.id, order_id: o?.id ?? null, admin_id: a.id, template: t?.name ?? null, status: 'opened' });
  return NextResponse.redirect(waLink(c.whatsapp_e164 || c.phone_e164, text), 302);
}
