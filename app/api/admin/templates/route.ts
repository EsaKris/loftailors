import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/notify';
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  const f = await req.formData();
  const back = NextResponse.redirect(new URL('/admin/templates', req.url), 303);
  const id = String(f.get('id') || '');
  await logActivity(a.id, 'whatsapp_template.' + (f.get('do') === 'delete' ? 'delete' : 'save'), 'template', id);
  if (f.get('do') === 'delete' && id) { await db.from('whatsapp_templates').delete().eq('id', id); return back; }
  const row = { name: String(f.get('name') || '').trim().slice(0, 80), body: String(f.get('body') || '').trim().slice(0, 1500), category: ['order', 'followup', 'promo'].includes(String(f.get('category'))) ? String(f.get('category')) : 'order', updated_at: new Date().toISOString() };
  if (!row.name || !row.body) return back;
  if (id) await db.from('whatsapp_templates').update(row).eq('id', id); else await db.from('whatsapp_templates').insert(row);
  return back;
}
