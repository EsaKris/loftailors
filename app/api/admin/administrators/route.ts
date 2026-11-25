import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin, PERMS } from '@/lib/auth';
import { logActivity } from '@/lib/notify';
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  const f = await req.formData(), act = String(f.get('do')), back = (m = '') => NextResponse.redirect(new URL('/admin/administrators' + (m ? `?msg=${encodeURIComponent(m)}` : ''), req.url), 303);
  const perms = () => Object.fromEntries(Object.keys(PERMS).map(k => [k, f.get('p_' + k) === 'on']));
  if (act === 'create') {
    const email = String(f.get('email') || '').trim().toLowerCase(), name = String(f.get('name') || '').trim(), pw = String(f.get('password') || '');
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || pw.length < 10) return back('Enter a name, a valid email and a password of at least 10 characters');
    const { data, error } = await db.auth.admin.createUser({ email, password: pw, email_confirm: true });
    if (error || !data.user) return back('Could not create user: ' + (error?.message || '').slice(0, 100));
    await db.from('administrators').insert({ id: data.user.id, name, role: 'staff', permissions: perms() });
    await logActivity(a.id, 'admin.create', 'administrator', data.user.id, email);
    return back('Staff account created. Share the password with them privately.');
  }
  const id = String(f.get('id'));
  if (act === 'perms') { await db.from('administrators').update({ permissions: perms() }).eq('id', id).eq('role', 'staff'); await logActivity(a.id, 'admin.permissions', 'administrator', id); }
  if (act === 'toggle' && id !== a.id) {
    const { data: t } = await db.from('administrators').select('active').eq('id', id).single();
    const next = !t?.active;
    await db.from('administrators').update({ active: next }).eq('id', id);
    await db.auth.admin.updateUserById(id, { ban_duration: next ? 'none' : '876000h' });   // also blocks sign-in at Supabase
    await logActivity(a.id, next ? 'admin.activate' : 'admin.deactivate', 'administrator', id);
  }
  return back();
}
