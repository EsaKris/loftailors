import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin, can } from '@/lib/auth';
import { logActivity } from '@/lib/notify';
const ST = ['not_contacted', 'contact_initiated', 'follow_up_required', 'completed', 'not_interested'];
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || !can(a, 'view_customers')) return new NextResponse('No permission', { status: 403 });
  const f = await req.formData(), id = String(f.get('id')), st = String(f.get('status'));
  if (ST.includes(st)) {
    const due = String(f.get('due_date') || '');
    await db.from('follow_up_tasks').update({ status: st, notes: String(f.get('notes') || '').slice(0, 500) || null, ...(/^\d{4}-\d{2}-\d{2}$/.test(due) ? { due_date: due } : {}), admin_id: a.id, updated_at: new Date().toISOString() }).eq('id', id);
    await logActivity(a.id, 'followup.update', 'follow_up', id, st);
  }
  return NextResponse.redirect(new URL('/admin/followups' + (f.get('f') ? `?f=${f.get('f')}` : ''), req.url), 303);
}
