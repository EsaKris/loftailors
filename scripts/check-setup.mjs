// Run:  npm run check
// Tests that your keys and database are wired correctly. It never prints a key.
import { readFileSync, existsSync } from 'node:fs';

const file = ['.env.local', '.env'].find(existsSync);
if (!file) { console.log('✗ No .env.local found. Copy .env.example to .env.local and fill it in.'); process.exit(1); }
for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const E = process.env;
let bad = 0, warn = 0;
const ok = (m) => console.log('✓', m);
const no = (m) => { bad++; console.log('✗', m); };
const wn = (m) => { warn++; console.log('!', m); };

// 1. variables
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PAYSTACK_SECRET_KEY', 'SITE_URL'])
  E[k] ? ok(`${k} is set`) : no(`${k} is missing in ${file}`);
if (!E.RESEND_API_KEY) wn('RESEND_API_KEY is empty: customer emails are switched off (orders and payments still work).');
if (!E.EMAIL_FROM && E.RESEND_API_KEY) no('EMAIL_FROM is missing');
if (!E.GOOGLE_SERVICE_ACCOUNT_EMAIL || !E.GOOGLE_PRIVATE_KEY || !E.GOOGLE_SHEET_ID) wn('Google Sheets backup is off. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_SHEET_ID. Orders are still saved in your database.');
else ok('Google Sheets backup credentials are present (not tested until the admin test entry).');
if (!E.CRON_SECRET) wn('CRON_SECRET is empty: the daily payment-recovery job will refuse to run (only matters once deployed).');
if (E.SITE_URL && E.SITE_URL.endsWith('/')) no('SITE_URL must not end with a slash');
if (E.SITE_URL && /localhost|127\.0\.0\.1/.test(E.SITE_URL)) wn('SITE_URL is a local address. Before going live set it to your real https:// domain, or Google will see localhost links.');
else if (E.SITE_URL && !E.SITE_URL.startsWith('https://')) wn('SITE_URL should start with https:// for the live site.');
if (!E.GOOGLE_SITE_VERIFICATION && !E.GOOGLE_VERIFICATION_FILE) wn('Google Search Console is not verified yet. Set GOOGLE_SITE_VERIFICATION (see SEO-SECURITY-GUIDE.md).');
if (!E.SECURITY_CONTACT) wn('SECURITY_CONTACT is empty: /.well-known/security.txt will not be published.');
for (const k of ['CRON_SECRET', 'UNSUBSCRIBE_SECRET']) if (E[k] && E[k].length < 32) wn(`${k} is short. Use at least 32 random characters (run: openssl rand -hex 32).`);
if (E.PAYSTACK_SECRET_KEY) {
  if (E.PAYSTACK_SECRET_KEY.startsWith('sk_test_')) ok('Paystack key is a TEST key (no real money moves)');
  else if (E.PAYSTACK_SECRET_KEY.startsWith('sk_live_')) wn('Paystack key is a LIVE key. Real money will move.');
  else no('PAYSTACK_SECRET_KEY should start with sk_test_ or sk_live_ (do not use the pk_ public key)');
}
if (bad) { console.log(`\n${bad} problem(s). Fix the lines above, then run again.`); process.exit(1); }

// 2. Supabase
const base = E.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const sb = (path, init = {}) => fetch(`${base}/rest/v1/${path}`, { ...init, headers: { apikey: E.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${E.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
const tables = ['administrators', 'customers', 'orders', 'order_items', 'payments', 'webhook_events', 'email_log', 'status_history', 'communication_logs',
  'variants', 'inventory_movements', 'refunds', 'settlements', 'whatsapp_templates', 'settings', 'offers', 'follow_up_tasks', 'notifications', 'admin_activity_logs', 'email_templates', 'backup_log', 'analytics_events', 'duplicate_dismissals', 'campaigns', 'variant_stock'];
try {
  const missing = [];
  for (const t of tables) { const r = await sb(`${t}?select=*&limit=1`); if (!r.ok) missing.push(`${t} (${r.status})`); }
  if (!missing.length) ok('All database tables exist'); else {
    no(`Missing or unreadable: ${missing.join(', ')}`);
    console.log('   → Run supabase/schema.sql, then 002_phase2.sql, 003_phase3.sql and 004_phase4.sql in the Supabase SQL Editor. If they all exist, your SUPABASE_SERVICE_ROLE_KEY may be wrong.');
  }
  const f = await sb('rpc/deduct_stock', { method: 'POST', body: JSON.stringify({ p_order: '00000000-0000-0000-0000-000000000000' }) });
  f.ok ? ok('Stock function exists') : no('Function deduct_stock is missing: run 002_phase2.sql');
  const a = await (await sb('administrators?select=role,active')).json();
  if (Array.isArray(a) && a.some(x => x.role === 'super' && x.active)) ok('You have an active Super Admin');
  else no('No Super Admin yet. Create a user in Supabase > Authentication, then insert a row into administrators (see README step 2).');
  const o = await (await sb('offers?select=q,price_kobo,active&order=q')).json();
  Array.isArray(o) && o.length ? ok(`Offers: ${o.map(x => `${x.q} for ₦${(x.price_kobo / 100).toLocaleString('en-NG')}`).join(', ')}`) : no('No offers found: run 003_phase3.sql');
  const s = await (await sb('settings?select=key,value&key=eq.delivery_fee_naira')).json();
  const fee = (s?.[0]?.value || E.DELIVERY_FEE_NAIRA || '').trim();
  fee !== '' && !isNaN(Number(fee)) ? ok(`Delivery fee for card orders: ₦${Number(fee).toLocaleString('en-NG')}`) : no('No delivery fee set. Card payment stays hidden until you set one (Admin > Offers & settings, or DELIVERY_FEE_NAIRA).');
} catch (e) { no(`Could not reach Supabase: ${e.message}`); }

// 3. Paystack
try {
  const r = await fetch('https://api.paystack.co/transaction?perPage=1', { headers: { Authorization: `Bearer ${E.PAYSTACK_SECRET_KEY}` } });
  const j = await r.json().catch(() => ({}));
  r.ok && j.status ? ok('Paystack accepted your secret key') : no(`Paystack rejected the key (${r.status}): ${j.message || 'unknown'}`);
} catch (e) { no(`Could not reach Paystack: ${e.message}`); }

// 4. Resend (optional)
if (E.RESEND_API_KEY) {
  try {
    const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${E.RESEND_API_KEY}` } });
    if (r.ok) ok('Resend accepted your key'); else if (r.status === 401 || r.status === 403) ok('Resend key looks valid (sending-only keys cannot list domains, which is fine)'); else wn(`Resend answered ${r.status}`);
  } catch (e) { wn(`Could not reach Resend: ${e.message}`); }
}

console.log(`\n${bad ? `${bad} problem(s) to fix.` : 'Everything is wired.'}${warn ? ` ${warn} note(s).` : ''}`);
if (!bad) {
  console.log(`\nNext:\n  1. npm run dev   → open ${E.SITE_URL}\n  2. Choose an offer, fill checkout, pay with a Paystack TEST card.\n  3. Webhook (only needed once deployed): Paystack dashboard (Test mode) > Settings > API Keys & Webhooks > Test Webhook URL = ${E.SITE_URL}/api/paystack/webhook`);
}
process.exit(bad ? 1 : 0);
