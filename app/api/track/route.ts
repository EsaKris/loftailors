import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { limited, ipOf } from '@/lib/ratelimit';
// Anonymous funnel events. No cookies, no IP address and no personal data are stored; the session id is a random string kept only in the visitor's tab.
const EV = ['view', 'offer_click', 'checkout_open', 'size_select', 'colour_select', 'pay_click', 'pay_redirect'];
export async function POST(req: Request) {
  if (limited('track:' + ipOf(req), 150, 10 * 60_000)) return new NextResponse(null, { status: 204 });
  let b: any; try { b = JSON.parse(await req.text()); } catch { return new NextResponse(null, { status: 204 }); }
  if (typeof b?.s === 'string' && /^[a-z0-9]{8,32}$/.test(b.s) && EV.includes(b.e)) {
    const q = Number(b.p?.q);
    await db.from('analytics_events').insert({ session: b.s, event: b.e, props: Number.isInteger(q) && q >= 1 && q <= 20 ? { q } : null });
  }
  return new NextResponse(null, { status: 204 });
}
