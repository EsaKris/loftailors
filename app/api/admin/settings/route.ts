import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/notify';
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  const f = await req.formData(), back = (m: string) => NextResponse.redirect(new URL(`/admin/settings?msg=${encodeURIComponent(m)}`, req.url), 303);
  if (f.get('do') === 'offer') {
    const q = parseInt(String(f.get('q')), 10), price = Math.round(Number(f.get('price')) * 100);
    if (![1, 2, 3, 5].includes(q) && !(q > 0 && q < 50)) return back('Invalid quantity');
    if (!(price > 0)) return back('Price must be above zero');
    const cl = (k: string, n: number) => String(f.get(k) || '').trim().slice(0, n);
    await db.from('offers').upsert({ q, price_kobo: price, free_text: cl('free_text', 120), label: cl('label', 40), tag: cl('tag', 24), cap: f.get('cap') === 'on', caps: Math.max(0, Math.min(10, parseInt(String(f.get('caps') || '0'), 10) || 0)), active: f.get('active') === 'on' }, { onConflict: 'q' });
    await logActivity(a.id, 'offer.update', 'offer', String(q), `${price / 100} NGN`);
    return back(`Offer for ${q} saved`);
  }
  if (f.get('do') === 'extras') {
    const list = String(f.get('list_price_naira') ?? '').trim().replace(/[,\s]/g, ''), socks = String(f.get('socks_per_jogger') ?? '1').trim();
    if (!/^\d*$/.test(list)) return back('Original price must be a number');
    if (!/^[0-3]$/.test(socks)) return back('Socks per jogger must be 0 to 3');
    const now = new Date().toISOString();
    await db.from('settings').upsert([{ key: 'list_price_naira', value: list, updated_at: now }, { key: 'socks_per_jogger', value: socks, updated_at: now }], { onConflict: 'key' });
    await logActivity(a.id, 'settings.extras', 'settings', undefined, `original ${list || 'off'}, socks ${socks}`);
    return back('Saved. The storefront updates within a minute.');
  }
  const keys: Record<string, RegExp> = { delivery_fee_naira: /^(\d+(\.\d+)?)?$/, high_value_naira: /^\d+$/, inactive_days: /^\d+$/, followup_days: /^\d+$/ };
  for (const [k, re] of Object.entries(keys)) { const v = String(f.get(k) ?? '').trim(); if (re.test(v)) await db.from('settings').upsert({ key: k, value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' }); }
  await db.from('settings').upsert({ key: 'whatsapp_orders', value: f.get('whatsapp_orders') === 'on' ? 'on' : 'off', updated_at: new Date().toISOString() }, { onConflict: 'key' });
  await logActivity(a.id, 'settings.update', 'settings');
  return back('Settings saved');
}
