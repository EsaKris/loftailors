import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { SIZES, COLOURS } from '@/lib/offers';
import { logActivity } from '@/lib/notify';
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  const f = await req.formData();
  const item = String(f.get('item') || '');
  if (item) {   // free gifts (socks / caps)
    const gd = parseInt(String(f.get('delta')), 10), gb = NextResponse.redirect(new URL('/admin/inventory', req.url), 303);
    if (!['socks', 'cap'].includes(item) || !gd || Math.abs(gd) > 100000) return gb;
    await db.from('gift_movements').insert({ item, delta: gd, reason: gd > 0 ? 'restock' : 'adjust', note: String(f.get('note') || '').slice(0, 200) || null, admin_id: a.id });
    await logActivity(a.id, 'inventory.gift', 'gift', item, String(gd));
    return gb;
  }
  const size = String(f.get('size')), colour = String(f.get('colour')), delta = parseInt(String(f.get('delta')), 10);
  const back = NextResponse.redirect(new URL('/admin/inventory', req.url), 303);
  if (!SIZES.includes(size) || !COLOURS.includes(colour) || !delta) return back;
  const { data: v } = await db.from('variants').upsert({ size, colour }, { onConflict: 'size,colour' }).select('id').single();
  if (v) await db.from('inventory_movements').insert({ variant_id: v.id, delta, reason: delta > 0 ? 'restock' : 'adjust', note: String(f.get('note') || '').slice(0, 200) || null, admin_id: a.id });
  await logActivity(a.id, 'inventory.adjust', 'variant', `${colour} ${size}`, String(delta));
  return back;
}
