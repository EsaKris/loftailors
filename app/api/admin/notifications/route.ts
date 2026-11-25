import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a) return new NextResponse('Unauthorised', { status: 401 });
  const f = await req.formData(), id = String(f.get('id') || '');
  const q = db.from('notifications').update({ read_at: new Date().toISOString(), read_by: a.id }).is('read_at', null);
  await (id ? q.eq('id', id) : q);
  return NextResponse.redirect(new URL('/admin/notifications', req.url), 303);
}
