// Runs automatically before `npm run dev` and `npm run build`.
// Fills in your real site address (SITE_URL) and writes every SEO / verification / security file the storefront needs:
//   public/index.html, robots.txt, sitemap.xml (with images), manifest.webmanifest,
//   .well-known/security.txt, the Google Search Console verification file (optional)
//   and .csp-hashes.json (so next.config.js can lock scripts down with a Content-Security-Policy).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file = ['.env.local', '.env'].find(existsSync);
if (file) for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const E = process.env;
let site = (E.SITE_URL || '').trim().replace(/\/+$/, '');
if (!site && E.VERCEL_PROJECT_PRODUCTION_URL) site = 'https://' + E.VERCEL_PROJECT_PRODUCTION_URL;
if (!site) { site = 'http://localhost:3000'; console.warn('! SITE_URL is not set: using http://localhost:3000 in share/search tags. Set it before deploying.'); }
const isLocal = /^https?:\/\/(localhost|127\.|0\.0\.0\.0)/.test(site);
if (!isLocal && !site.startsWith('https://')) console.warn('! SITE_URL should start with https:// in production.');
// Preview deployments and local builds must never be indexed (prevents duplicate-content and leaked staging pages).
const indexable = !isLocal && (!E.VERCEL_ENV || E.VERCEL_ENV === 'production');

const day = new Date(), iso = day.toISOString().slice(0, 10);
const until = new Date(day.getTime() + 365 * 864e5).toISOString().slice(0, 10);
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ── Verification tags (values are validated so nothing odd can be injected into the page) ──
const tok = (v) => /^[A-Za-z0-9_\-]{16,120}$/.test((v || '').trim()) ? v.trim() : '';
const gTok = tok(E.GOOGLE_SITE_VERIFICATION), bTok = tok(E.BING_SITE_VERIFICATION);
if (E.GOOGLE_SITE_VERIFICATION && !gTok) console.warn('! GOOGLE_SITE_VERIFICATION looks wrong: paste only the content="..." value. Ignored.');
if (E.BING_SITE_VERIFICATION && !bTok) console.warn('! BING_SITE_VERIFICATION looks wrong: paste only the content value. Ignored.');
const verify = [
  gTok && `<meta name="google-site-verification" content="${esc(gTok)}">`,
  bTok && `<meta name="msvalidate.01" content="${esc(bTok)}">`,
].filter(Boolean).join('\n');

let html = readFileSync('site/index.template.html', 'utf8')
  .replace('<!--SEO_VERIFICATION-->', verify)
  .replaceAll('__SITE_URL__', site).replaceAll('__BUILD_DATE__', iso).replaceAll('__PRICE_VALID_UNTIL__', until);
if (!indexable) html = html.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex, nofollow">').replace(/<meta name="googlebot"[^>]*>/, '');
writeFileSync('public/index.html', html);

// ── robots.txt ──
const blocked = ['/admin', '/api/', '/login', '/order/', '/unsubscribe'];
writeFileSync('public/robots.txt', indexable
  ? `User-agent: *\nAllow: /\n${blocked.map(p => `Disallow: ${p}`).join('\n')}\n\nSitemap: ${site}/sitemap.xml\n`
  : `User-agent: *\nDisallow: /\n`);

// ── sitemap.xml (with the product images so Google Images can pick them up) ──
const imgs = ['img/front.webp', 'img/back.webp', ...['1', '2', '3', '4', '5', '6'].map(n => `gallery/g${n}.webp`)];
writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${site}/</loc>
    <lastmod>${iso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
${imgs.map(i => `    <image:image><image:loc>${site}/assets/${i}</image:loc></image:image>`).join('\n')}
  </url>
</urlset>
`);

// ── Web app manifest ──
writeFileSync('public/manifest.webmanifest', JSON.stringify({
  name: 'LOFT — Lilies of the Field Tailors', short_name: 'LOFT', description: 'LOFT men’s joggers from Lilies of the Field Tailors.',
  start_url: '/', scope: '/', display: 'browser', lang: 'en-NG', background_color: '#f3e9e0', theme_color: '#f3e9e0',
  icons: [{ src: '/assets/img/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/assets/img/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
}, null, 2) + '\n');

// ── security.txt (RFC 9116) ──
const contact = (E.SECURITY_CONTACT || '').trim();
mkdirSync('public/.well-known', { recursive: true });
if (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(contact)) {
  const exp = new Date(day.getTime() + 364 * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  writeFileSync('public/.well-known/security.txt', `Contact: mailto:${contact}\nExpires: ${exp}\nPreferred-Languages: en\nCanonical: ${site}/.well-known/security.txt\n`);
} else {
  try { unlinkSync('public/.well-known/security.txt'); } catch {}
  console.warn('! SECURITY_CONTACT is not set: no /.well-known/security.txt published.');
}

// ── Google Search Console HTML-file verification (optional alternative to the meta tag) ──
for (const f of readdirSync('public')) if (/^google[a-f0-9]+\.html$/.test(f)) unlinkSync('public/' + f);   // drop stale files
const vf = (E.GOOGLE_VERIFICATION_FILE || '').trim();
if (vf) {
  if (/^google[a-f0-9]{8,64}\.html$/.test(vf)) writeFileSync('public/' + vf, `google-site-verification: ${vf}`);
  else console.warn('! GOOGLE_VERIFICATION_FILE must look like google1a2b3c4d5e6f.html. Ignored.');
}

// ── Content-Security-Policy hashes for the storefront's own inline script ──
// Browsers only run an inline script whose SHA-256 matches, so injected scripts are blocked even if an attacker finds a hole.
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
writeFileSync('.csp-hashes.json', JSON.stringify({ scriptHashes: hashes }));

console.log(`✓ storefront built for ${site} (${indexable ? 'indexable' : 'NOINDEX: local or preview build'}); ${hashes.length} inline script hash(es)`);
