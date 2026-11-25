import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/notify';
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  const f = await req.formData(), keep = String(f.get('keep')), dup = String(f.get('dup')), back = NextResponse.redirect(new URL('/admin/duplicates', req.url), 303);
  if (!keep || !dup || keep === dup) return back;
  if (f.get('do') === 'dismiss') { const [x, y] = [keep, dup].sort(); await db.from('duplicate_dismissals').upsert({ a: x, b: y }); return back; }
  if (f.get('do') === 'merge') {
    const { data: k } = await db.from('customers').select('*').eq('id', keep).single(), { data: d } = await db.from('customers').select('*').eq('id', dup).single();
    if (!k || !d) return back;
    for (const t of ['orders', 'follow_up_tasks', 'communication_logs', 'email_log']) await db.from(t).update({ customer_id: keep }).eq('customer_id', dup);
    await db.from('customers').update({
      email: k.email || d.email, marketing_consent: k.marketing_consent || d.marketing_consent, consent_at: k.consent_at || d.consent_at,
      notes: [k.notes, d.notes && `Merged from ${d.full_name} ${d.phone_e164}: ${d.notes}`].filter(Boolean).join('\n') || null, updated_at: new Date().toISOString(),
    }).eq('id', keep);
    await db.from('customers').delete().eq('id', dup);
    await logActivity(a.id, 'customer.merge', 'customer', keep, `merged ${d.phone_e164}`);
  }
  return back;
}
