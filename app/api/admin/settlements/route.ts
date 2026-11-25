import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdmin } from '@/lib/auth';
import { listSettlements } from '@/lib/paystack';
export async function POST(req: Request) {
  const a = await getAdmin();
  if (!a || a.role !== 'super') return new NextResponse('Super Admin only', { status: 403 });
  let msg = 'Synced';
  try {
    const rows = (await listSettlements()).map((s: any) => ({ paystack_id: String(s.id), status: s.status ?? null, total_amount_kobo: s.total_amount ?? null, effective_amount_kobo: s.effective_amount ?? s.total_amount ?? null, fees_kobo: s.total_fees ?? null, settlement_date: s.settlement_date ?? s.createdAt ?? null, raw: s }));
    if (rows.length) await db.from('settlements').upsert(rows, { onConflict: 'paystack_id' });
    msg = `Synced ${rows.length} settlements`;
  } catch (e: any) { msg = 'Sync failed: ' + String(e.message).slice(0, 100); }
  return NextResponse.redirect(new URL(`/admin/settlements?msg=${encodeURIComponent(msg)}`, req.url), 303);
}
