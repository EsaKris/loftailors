import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/auth';
import { sendTestEntry, retryBackups } from '@/lib/sheets';
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  const f = await req.formData(); let msg = '';
  try {
    if (f.get('do') === 'test') { await sendTestEntry(); msg = 'Test entry sent. Open your Google Sheet and check that the TEST-ENTRY row appeared.'; }
    else msg = `Retried ${await retryBackups()} backup(s)`;
  } catch (e: any) { msg = 'Backup problem: ' + String(e.message).slice(0, 120); }
  return NextResponse.redirect(new URL(`/admin/settings?msg=${encodeURIComponent(msg)}`, req.url), 303);
}
