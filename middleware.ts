import { NextResponse, type NextRequest } from 'next/server';

// 1) CSRF / cross-site request guard for every state-changing request to the admin and checkout APIs.
// 2) First gate + silent session refresh for /admin pages. Every admin page ALSO re-verifies the session and role on the server.
const exp = (t: string) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch { return 0; } };

const trustedHosts = () => {
  const s = new Set<string>();
  try { if (process.env.SITE_URL) s.add(new URL(process.env.SITE_URL).host); } catch {}
  return s;
};
// A browser always sends Origin (or at least Sec-Fetch-Site) on cross-site POSTs. Reject anything that is not our own site.
function sameSite(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const origin = req.headers.get('origin');
  if (origin) { try { const h = new URL(origin).host; return h === host || trustedHosts().has(h); } catch { return false; } }
  const fetchSite = req.headers.get('sec-fetch-site');
  return !fetchSite || fetchSite === 'same-origin' || fetchSite === 'none';   // no header at all = not a browser (curl, server code)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameSite(req)) return new NextResponse('Cross-site request blocked', { status: 403 });
    return NextResponse.next();   // admin API routes verify the session themselves
  }

  const at = req.cookies.get('sb-at')?.value, rt = req.cookies.get('sb-rt')?.value;
  if (at && exp(at) > Date.now() + 60_000) return NextResponse.next();
  if (rt) {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }) });
      if (r.ok) {
        const s = await r.json();
        const res = NextResponse.redirect(req.url);   // same page again, now with fresh cookies
        const o = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
        res.cookies.set('sb-at', s.access_token, { ...o, maxAge: s.expires_in });
        res.cookies.set('sb-rt', s.refresh_token, { ...o, maxAge: 60 * 60 * 24 * 30 });
        return res;
      }
    } catch {}
  }
  return NextResponse.redirect(new URL('/login', req.url));
}
// Only admin pages and the browser-facing POST endpoints. Webhooks (Paystack, Resend), the cron job and the public tracker are NOT listed.
export const config = { matcher: ['/admin/:path*', '/api/admin/:path*', '/api/checkout'] };
