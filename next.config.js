const fs = require('fs');
const dev = process.env.NODE_ENV !== 'production';

// ── Site address, used for the canonical-host redirect ──
let site = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
if (!site && process.env.VERCEL_PROJECT_PRODUCTION_URL) site = 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
let host = ''; try { host = new URL(site).host; } catch {}
const live = !!host && !/^(localhost|127\.|0\.0\.0\.0)/.test(host);
const altHost = live ? (host.startsWith('www.') ? host.slice(4) : 'www.' + host) : '';
const previewOnly = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production';

// ── Content-Security-Policy ──
// Storefront (static page): scripts may only run if they are our own file or match the SHA-256 written by scripts/prebuild.mjs.
let hashes = []; try { hashes = JSON.parse(fs.readFileSync('.csp-hashes.json', 'utf8')).scriptHashes || []; } catch {}
const common = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
  "img-src 'self' data: blob:", "font-src 'self' https://fonts.gstatic.com", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "manifest-src 'self'", "frame-src 'none'", "worker-src 'none'",
];
const prodOnly = dev ? [] : ['upgrade-insecure-requests'];
const storeCsp = [...common, `script-src 'self' ${hashes.length ? hashes.join(' ') : "'unsafe-inline'"}`, "connect-src 'self'", ...prodOnly].join('; ');
// Admin / login / order pages are built by Next.js, which injects its own inline bootstrap scripts, so 'unsafe-inline' is needed here.
// Everything else (framing, plugins, third-party scripts, outside connections, form targets) is still locked down.
const appCsp = [...common, `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`, `connect-src 'self'${dev ? ' ws: wss:' : ''}`, ...prodOnly].join('; ');

const baseSecurity = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
  ...(previewOnly ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
];
const noindex = { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' };
const noStore = { key: 'Cache-Control', value: 'private, no-store, max-age=0' };
const csp = (v) => ({ key: 'Content-Security-Policy', value: v });

module.exports = {
  poweredByHeader: false,           // do not advertise the framework
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  compress: true,
  // "/" is the storefront page that scripts/prebuild.mjs writes to public/index.html
  async rewrites() { return [{ source: '/', destination: '/index.html' }]; },
  async redirects() {
    return [
      // One address per page: /index.html duplicates "/", so send it there permanently.
      { source: '/index.html', destination: '/', permanent: true },
      // www and non-www must not both exist (duplicate content). Everything goes to the address in SITE_URL.
      ...(altHost ? [{ source: '/:path*', has: [{ type: 'host', value: altHost }], destination: `${site}/:path*`, permanent: true }] : []),
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: baseSecurity },
      // Public storefront
      { source: '/', headers: [csp(storeCsp)] },
      { source: '/index.html', headers: [csp(storeCsp)] },
      // Private app pages and APIs: never indexed, never cached by browsers/CDNs
      ...['/admin/:path*', '/login', '/order/:path*', '/unsubscribe'].map(source => ({ source, headers: [csp(appCsp), noindex, noStore] })),
      { source: '/order/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },   // order URLs carry the payment reference
      { source: '/api/:path*', headers: [noindex] },
      { source: '/api/admin/:path*', headers: [noStore] },
      { source: '/api/checkout', headers: [noStore] },
      { source: '/api/paystack/:path*', headers: [noStore] },
      // Static files
      { source: '/assets/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }] },
      { source: '/manifest.webmanifest', headers: [{ key: 'Content-Type', value: 'application/manifest+json' }] },
      { source: '/.well-known/security.txt', headers: [{ key: 'Content-Type', value: 'text/plain; charset=utf-8' }] },
    ];
  },
};
