# LOFT — SEO, Google verification and security guide

Nobody can honestly promise a #1 ranking. What this project now does is remove every technical obstacle, so rankings depend only on content, reputation and time. Steps 1–5 below are the parts only you can do (they need your Google account).

## What was added in the code

**SEO (storefront `site/index.template.html` + `scripts/prebuild.mjs`)**
- Optimised title and description, canonical URL, `hreflang="en-NG"`, `robots` meta with large image previews.
- Open Graph and Twitter cards (1200×630 image) for WhatsApp, Facebook, X and LinkedIn previews.
- JSON-LD structured data: Organization, WebSite, WebPage, Product (price, NGN, availability, images) and FAQPage. The FAQ text matches the visible FAQ exactly, as Google requires.
- `sitemap.xml` (with product images and last-modified date), `robots.txt`, `manifest.webmanifest`.
- `/index.html` redirects to `/`, and www ↔ non-www redirect to the address in `SITE_URL` (no duplicate-content penalty).
- Preview/local builds are automatically `noindex` so staging pages never reach Google.
- Verification tags for Google and Bing, filled from environment variables.

**Security**
- Headers on every response: HSTS (2 years), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP. Framework version header removed.
- **Content-Security-Policy.** Storefront: scripts only run if they match a SHA-256 hash generated at build time, so injected scripts are blocked. Admin pages: no framing, no foreign scripts/connections, no plugins, forms only to your own site.
- CSRF guard in `middleware.ts`: every admin POST/PUT/DELETE and checkout must come from your own site.
- Login limited per IP **and** per email (slows password guessing); Paystack verify endpoint rate-limited and input-validated.
- Public price/stock/config endpoints cached 15–30 s at the edge to protect your database. Admin/API/order pages are `no-store` and `noindex`; order pages send no referrer (URL contains the payment reference).
- `/.well-known/security.txt` so researchers can report problems.
- `.gitignore` keeps `.env*`, Google keys, backups and exported customer data out of Git.

Already good in your code (kept): server-side price calculation, Paystack webhook HMAC check with timing-safe compare, Resend/Svix signature check, cron secret, Sheets written with `RAW` mode (no formula injection), export formula-injection guard, role/permission re-checks on every admin page, HttpOnly cookies.

## Step 1 — Set your environment variables (Vercel > Settings > Environment Variables)
`SITE_URL=https://yourdomain.com` (exact final address, no trailing slash) and `SECURITY_CONTACT=you@yourdomain.com`. Redeploy.

## Step 2 — Google Search Console (this is the "Google verification")
1. Go to search.google.com/search-console, **Add property > URL prefix**, enter your `SITE_URL`.
2. Choose **HTML tag**. Copy only the value inside `content="..."`.
3. Put it in `GOOGLE_SITE_VERIFICATION`, redeploy, then click **Verify**.
   (Alternative: choose **HTML file**, put the file name e.g. `google1a2b3c4d5e6f.html` in `GOOGLE_VERIFICATION_FILE`, redeploy, verify.)
4. **Sitemaps** > add `sitemap.xml` > Submit.
5. **URL Inspection** > paste your home page > **Request indexing**.
6. Keep the verification tag/file in place permanently, or Google un-verifies you.

## Step 3 — Bing Webmaster Tools
bing.com/webmasters > Add site > HTML meta tag > put the value in `BING_SITE_VERIFICATION`. (You can also import from Search Console.) Bing also feeds DuckDuckGo, Yahoo and ChatGPT search.

## Step 4 — Google Business Profile (biggest boost for "joggers in Lagos/Nigeria" searches)
business.google.com > create a profile for Lilies of the Field Tailors. Use the same name and phone (0704 777 3134) as the site, choose the right category (e.g. "Clothing store" or "Tailor"), add your real address or service area, photos, and your website URL. Verify by the method Google offers. Ask happy customers for reviews.

## Step 5 — Google Merchant Center (free product listings in Google Shopping)
merchants.google.com > claim your website > add the jogger product with the same price and images as the site. Free listings let your product show in Google Shopping and Images. Keep the Merchant price equal to the site price.

## Step 6 — Check it worked
- search.google.com/test/rich-results — test your URL (Product and FAQ should show as valid).
- pagespeed.web.dev — check mobile score; keep image sizes small.
- securityheaders.com and observatory.mozilla.org — expect an A or A+.
- Share the link in WhatsApp and check the preview card shows the image and title.

## What actually gets you to the top (the part code cannot do)
1. **Backlinks and mentions**: Instagram/TikTok/X profiles linking to the site, Nigerian fashion blogs, influencer posts, directories (Jiji, Nairaland, local business listings). Add your social profile URLs to `sameAs` in the Organization JSON-LD once they exist.
2. **Reviews** on Google Business Profile.
3. **More indexable pages**: a one-page site can rank for few phrases. Add pages such as a size guide, a care guide, "men's joggers in Lagos", delivery information, and a blog or lookbook. Each page needs its own title, description, canonical and sitemap entry.
4. **Speed on mobile**: the scroll-frame animation loads many images; keep the first frame small (already preloaded).
5. **Time**: new sites usually take weeks to months to rank.

## Remaining security tasks (outside the code)
- Turn on 2-factor sign-in for Vercel, GitHub, Supabase, Paystack, Google, Resend and your domain registrar.
- Supabase: confirm Row Level Security is ON for every table (the app only uses the service key on the server). Never put `SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY` or `GOOGLE_PRIVATE_KEY` anywhere in the browser code or in Git. If a key was ever committed or shared, rotate it.
- Use `sk_live_` only after test payments pass. Generate `CRON_SECRET` and `UNSUBSCRIBE_SECRET` with `openssl rand -hex 32`.
- Share the Google Sheet only with the service-account email (Editor) and yourself.
- Rate limiting is per server instance. For a hard guarantee, swap `lib/ratelimit.ts` for Upstash Redis (free tier).
- Optional: submit the domain to hstspreload.org once every subdomain is HTTPS-only.
- Admin pages use `'unsafe-inline'` scripts because of how Next.js boots. A nonce-based CSP can remove that; ask if you want it.
- Run `npm audit` regularly and keep Next.js updated.
- If your `.env` or `public/index.html` are already tracked in Git, untrack them: `git rm --cached .env.local public/index.html public/robots.txt public/sitemap.xml`.

## Things to know
- Prices in the page's structured data (₦20,499) are fixed in the template. If you change prices in Admin > Settings, also edit `site/index.template.html` (search `20499`, `38999`) so Google shows the same price. The struck-out original price is set in Admin > Offers & settings and is only displayed, never charged.
- The code was changed and checked with scripts (prebuild output, JSON-LD validity, CSP generation) but I could not run `npm install` / `next build` here (no network). Run `npm install && npm run build` once and test checkout, login and admin before going live.


## Supabase admin password recovery

- Set `SITE_URL` in Vercel Production to `https://www.loftailors.com` (no trailing slash).
- In Supabase Authentication → URL Configuration, set Site URL to `https://www.loftailors.com`.
- Add `https://www.loftailors.com/reset-password` to the allowed Redirect URLs. Keep localhost only for local development if needed.
- Redeploy after changing Vercel environment variables.
- Admin login now links to `/forgot-password`; recovery emails return to `/reset-password`.
- The reset page consumes the Supabase recovery session in the browser, updates the password through Supabase Auth, signs out, and asks the administrator to sign in again through the existing admin login flow.
