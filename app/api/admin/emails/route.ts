import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/notify';
import { COPY } from '@/lib/email';
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  const f = await req.formData(), type = String(f.get('type'));
  if (type in COPY) {
    if (f.get('do') === 'reset') await db.from('email_templates').delete().eq('type', type);
    else await db.from('email_templates').upsert({ type, subject: String(f.get('subject') || '').slice(0, 150) || null, line: String(f.get('line') || '').slice(0, 600) || null, active: f.get('active') === 'on', updated_at: new Date().toISOString() }, { onConflict: 'type' });
    await logActivity(a.id, 'email_template.update', 'email_template', type);
  }
  return NextResponse.redirect(new URL('/admin/emails', req.url), 303);
}
