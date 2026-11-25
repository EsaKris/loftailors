import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { logActivity } from '@/lib/notify';
import { unsubLink } from '@/lib/unsub';
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const html = (body: string, first: string, link: string) => `<div style="background:#f6f3ee;padding:24px;font-family:Arial,sans-serif;color:#111"><div style="max-width:520px;margin:0 auto;background:#fff"><div style="background:#000;color:#fff;padding:22px;text-align:center;letter-spacing:.3em;font-weight:bold">LOFT</div><div style="padding:26px"><p>Hello ${esc(first)},</p><p>${esc(body).replace(/\n/g, '<br>')}</p><p style="color:#666;font-size:12px;margin-top:28px">LOFT — Lilies of the Field Tailors. You are receiving this because you agreed to hear from us. <a href="${link}">Unsubscribe</a></p></div></div></div>`;
async function send(msgs: any[]) {
  const r = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(msgs) });
  return r.ok;
}
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  const f = await req.formData(), subject = String(f.get('subject') || '').trim().slice(0, 150), body = String(f.get('body') || '').trim().slice(0, 3000);
  const back = (m: string) => NextResponse.redirect(new URL(`/admin/campaigns?msg=${encodeURIComponent(m)}`, req.url), 303);
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return back('Resend is not configured');
  if (!subject || !body) return back('Write a subject and a message');
  const mk = (c: { id: string; full_name: string; email: string }) => ({ from: process.env.EMAIL_FROM, to: [c.email], subject, html: html(body, c.full_name.split(' ')[0], unsubLink(c.id)), headers: { 'List-Unsubscribe': `<${unsubLink(c.id)}>` } });
  if (f.get('do') === 'test') {
    const { data: u } = await db.auth.admin.getUserById(a.id);
    if (!u.user?.email) return back('No email on your account');
    return back((await send([mk({ id: a.id, full_name: a.name, email: u.user.email })])) ? `Test sent to ${u.user.email}` : 'Test failed (check Resend key and sender)');
  }
  if (f.get('confirm') !== 'on') return back('Tick the confirmation box to send');
  // ONLY customers who opted in and have an email. Opt-outs are excluded automatically.
  const { data: cs } = await db.from('customers').select('id, full_name, email').eq('marketing_consent', true).not('email', 'is', null);
  const list = (cs || []).filter((c: any) => c.email);
  let sent = 0, failed = 0;
  for (let i = 0; i < list.length; i += 100) { const chunk = list.slice(i, i + 100); (await send(chunk.map(mk as any))) ? (sent += chunk.length) : (failed += chunk.length); }
  await db.from('campaigns').insert({ subject, body, recipients: list.length, sent, failed, admin_id: a.id });
  await logActivity(a.id, 'campaign.send', 'campaign', '', `${sent} sent, ${failed} failed`);
  return back(`Sent to ${sent} customer(s)${failed ? `, ${failed} failed` : ''}`);
}
