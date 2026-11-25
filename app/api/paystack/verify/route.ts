import { NextResponse } from 'next/server';
import { settlePayment } from '@/lib/settle';
import { limited, ipOf } from '@/lib/ratelimit';
export async function GET(req: Request) {
  if (limited('verify:' + ipOf(req), 40, 10 * 60_000)) return NextResponse.json({ ok: false }, { status: 429 });
  const ref = new URL(req.url).searchParams.get('reference');
  if (!ref || ref.length > 100 || !/^[\w.\-]+$/.test(ref)) return NextResponse.json({ ok: false }, { status: 400 });
  try { return NextResponse.json(await settlePayment(ref)); } catch { return NextResponse.json({ ok: false, status: 'error' }, { status: 502 }); }
}
