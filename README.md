# LOFT Store — storefront + orders + Paystack + admin dashboard

What is in this phase
- `public/index.html` — the LOFT Joggers storefront (served at `/`). Checkout saves the order, then opens WhatsApp or Paystack.
- `/api/checkout` — validates the order, **recomputes the price on the server**, saves customer + order, starts Paystack.
- `/api/paystack/webhook` — verifies Paystack's signature, ignores duplicate events, confirms the payment with Paystack.
- `/order/status` — where Paystack sends the customer back. It re-verifies with Paystack; the URL alone proves nothing.
- `/login` and `/admin` — Overview, Orders (status, notes, manual payment, WhatsApp button), Customers (search, history, WhatsApp button).
- Automatic emails (Resend): order received, payment confirmed, processing, ready for dispatch, dispatched, delivered, cancelled. Each is sent once per order.

> **SEO, Google verification and security:** see [SEO-SECURITY-GUIDE.md](SEO-SECURITY-GUIDE.md).

## Quick wiring check
After filling `.env.local` and running the SQL files, run `npm run check`. It tests the database, your Paystack test key, delivery fee, admin account and Resend, and tells you exactly what is missing. It never prints your keys.

**Testing payments on your own computer:** card payments work fully on localhost, because after paying, Paystack sends the customer back to `/order/status`, which verifies the payment with Paystack itself. The webhook can only reach you once the site is deployed (or through a tunnel such as ngrok), and it is a safety net, not required for testing. Paystack test cards are listed in Paystack's docs (search "test cards").

## Setup (about 30 minutes)
1. **Supabase**: create a project. SQL Editor → paste `supabase/schema.sql` → Run. Then run `supabase/002_phase2.sql` (inventory, refunds, settlements, tracking, WhatsApp templates), then `supabase/003_phase3.sql` (settings, DB-driven offers, follow-ups, notifications, activity log, email templates, staff control), then `supabase/004_phase4.sql` (backup log, funnel events, duplicates, campaigns), then `supabase/005_phase5.sql` (cart pricing: free-cap quantities). After pulling this version run `npm install` again (adds `exceljs` and `pdfkit`).
2. **Your admin login**: Supabase → Authentication → Users → Add user (email + password). Copy the user's UUID, then run in SQL Editor:
   `insert into administrators (id, name, role) values ('<UUID>', 'Your Name', 'super');`
   (Use role `staff` for staff: they cannot see revenue or mark orders paid.)
3. **Paystack**: dashboard → Settings → API Keys. Start with the **test** secret key (`sk_test_...`).
4. **Resend**: create an account, verify your domain, create an API key.
5. `cp .env.example .env.local` and fill every value. `DELIVERY_FEE_NAIRA` must be set (e.g. `3000`) or card payment stays hidden and only WhatsApp ordering is offered.
6. `npm install` then `npm run dev` → http://localhost:3000
7. **Webhook**: after deploying, Paystack → Settings → API Keys & Webhooks → set **Webhook URL** to `https://YOUR-SITE/api/paystack/webhook`.

## Deploy (Vercel)
Push to GitHub → import in Vercel → add the same variables from `.env.local` (set `SITE_URL` to your real URL) → Deploy.

## Test before going live
- Place a WhatsApp order → it appears in `/admin/orders` with a LOFT-xxxxxx number.
- Place a card order with a Paystack **test card** → `/order/status` shows "Order confirmed", the order shows paid, one payment email arrives.
- Reload `/order/status` several times and replay the webhook from Paystack → still exactly one email, one paid record.
- Close the Paystack page without paying → order stays unpaid.
- Then swap in the live key (`sk_live_...`) and repeat with a small real payment.

## Change prices, sizes, colours
- Server prices: `lib/offers.ts` (kobo). Storefront display prices and colours: the `PACKS` / `COLOURS` constants near the top of the script in `public/index.html`. **Keep both in sync.** The server price is the one charged.
- The 3- and 5-joggers prices are currently 3x and 5x the single price. Confirm or change them in both places.

## Phase 2 additions
- **Inventory** (`/admin/inventory`): add stock per size and colour. Tracked combinations drop by 1 for every paid jogger (once per item, even if the webhook repeats) and are blocked at checkout at 0; the storefront greys out sold-out sizes. Combinations you have not added are not tracked and never block a sale. Only Super Admins change stock.
- **Refunds** (order page, Super Admin): full or partial. Paystack payments call Paystack's refund API and show "pending" until Paystack's `refund.processed` webhook arrives; manual payments record the refund only (you return the money yourself). The order becomes refunded or partially refunded and the customer gets one refund email. **Test refunds in Paystack test mode first**: the webhook field names were written from Paystack's documentation, not verified against a live event.
- **Settlements** (`/admin/settlements`, Super Admin): "Sync" pulls Paystack's settlement records, then compares verified payments − fees − refunds with what Paystack settled. It does not read your bank account.
- **Exports**: orders, customers and payments as CSV (opens in Excel) from the Settlements page. Staff can export orders without money columns only.
- **Delivery details**: courier, tracking number/link and expected date per order. Save them, then mark the order dispatched so the email includes them. Nothing is invented when blank.
- **Emails**: failed emails show a Retry button on the order page; refund emails added.
- **WhatsApp templates** (`/admin/templates`): editable, with placeholders. The customer and order pages list one-click template buttons. Opening is logged as "opened" (we cannot know if it was sent). Promotional templates are blocked for customers who have not opted in.

## Card-only checkout
WhatsApp ordering is switched OFF by default: the storefront shows only "Pay securely by card". To bring it back, tick "Allow orders sent through WhatsApp" in Offers & settings. Card payment needs a Paystack key and a delivery fee (Settings). Until both exist the checkout shows "Online ordering opens soon". The WhatsApp chat link in the footer and the admin's WhatsApp customer buttons are unchanged.

## Phase 3 additions (admin completed)
- **Offers & settings** (`/admin/settings`, Super Admin): edit the 1/2/3/5-joggers prices, free items, badges and active dates **in the dashboard**. The storefront loads them from `/api/offers` and the server charges the same numbers, so they cannot disagree. Also: delivery fee (empty = card payment off), high-value threshold, inactive days, follow-up days. Once LOFT confirms the two-joggers gift, type it in that offer's "free item" field. The 3/5 prices were seeded as 3x/5x the single price: confirm them here.
- **Follow-ups**: a task is created automatically when an order is marked delivered. Statuses: not contacted, contact initiated, follow-up required, completed, not interested; due dates, notes, overdue filter, WhatsApp button.
- **Segments**: first-time, repeat, high-value, inactive, recent, opted-in, not opted-in, each with a customer list and WhatsApp buttons. Spend counts verified payments only.
- **Notifications**: new orders, payments confirmed/failed/abandoned, low and out of stock, refunds. Unread count in the menu; mark read.
- **Administrators** (Super Admin): create staff, tick what each may do (update orders, view customers, WhatsApp, view inventory, export orders), deactivate/reactivate (also bans the login at Supabase). Staff never see revenue, refunds, settlements, settings or this page.
- **Activity log**: who changed what (orders, stock, offers, staff, exports...).
- **Email templates**: edit subject/message per notification type or switch a type off; counts of sent/failed.
- **Reports**: this month vs last month, 30-day revenue bars, revenue by offer. **Print / PDF** on each order (use the browser's Save as PDF).
- **Missed-webhook recovery**: `/api/cron/reconcile` re-checks pending payments with Paystack and marks 24h-old unpaid card checkouts as abandoned. Set `CRON_SECRET` in your environment. `vercel.json` runs it daily (Vercel's free Hobby plan allows daily at most; Pro can run it hourly).
- **Security**: sessions refresh silently for 30 days; login and checkout are rate-limited per server instance (blunts abuse; for a hard limit use Upstash Redis).

## Phase 4 additions
### Google Sheets backup (every customer entry)
Every new order is written to your private Google Sheet, including unpaid orders. When payment is verified, the same spreadsheet row is updated to `PAID` rather than adding a duplicate. The Supabase database remains the source of truth. Google failures do not block checkout or payment; failed entries are retried by the daily reconcile job or the **Retry failed** button in Offers & settings.

1. Create a Google Cloud project at https://console.cloud.google.com/.
2. Enable **Google Sheets API** for that project: https://console.cloud.google.com/apis/library/sheets.googleapis.com.
3. Open **IAM & Admin → Service Accounts**, create a service account (for example `loft-sheets-backup`), then open its **Keys** tab and create a JSON key. Keep the downloaded JSON private.
4. Open the JSON file in a text editor. Copy `client_email` and `private_key`.
5. Open your LOFT Customer Orders Backup spreadsheet and click **Share**. Share it with the service account's `client_email` address and give it **Editor** access. Do not make the sheet public.
6. Copy the spreadsheet ID from its URL: the text between `/spreadsheets/d/` and `/edit`. The default tab name is `Sheet1`; set `GOOGLE_SHEET_TAB` to the actual tab name if yours is different. The first row must contain the 17 column headings in this order: `Event, Order Number, Placed At, Channel, Customer Name, Phone, Email, Delivery Address, City, State, Items, Offer, Free Items, Total (NGN), Payment Status, Marketing Consent, Customer Note`.
7. Add these server-side variables to `.env.local` (never use `NEXT_PUBLIC_` for them):

   ```env
   GOOGLE_SERVICE_ACCOUNT_EMAIL=the-client_email-from-json
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...key contents...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEET_ID=the-spreadsheet-id-from-the-url
   GOOGLE_SHEET_TAB=Sheet1
   ```

   Keep the private key on one line with literal `\n` between key lines, as shown. Do not commit `.env.local` or the JSON key to GitHub.
8. Add the same four variables in **Vercel → Project → Settings → Environment Variables**. Redeploy after saving.
9. In the admin dashboard, open **Offers & settings → Google Sheets backup → Send test entry**. Confirm a row with order number `TEST-ENTRY` appears. You can delete that test row afterwards.

The Google Sheet contains customer names, phone numbers and delivery addresses. Restrict access to people who need it and describe the backup in your privacy notice. Card details are never copied.

### Other additions
- **Email delivery status**: in Resend → Webhooks add `https://YOUR-SITE/api/resend/webhook` (events: delivered, bounced, complained, delivery delayed), put the signing secret in `RESEND_WEBHOOK_SECRET`. Emails then show delivered/bounced/complained.
- **Funnel** (`/admin/funnel`): visitors → chose an offer → clicked Pay → reached Paystack → paid. First-party and anonymous: no cookies, no IP addresses, no personal data; the purchase is matched through the same random visit id. No PostHog needed.
- **Duplicates** (`/admin/duplicates`): flags customers sharing an email, or a name and address, under different phone numbers. You merge or dismiss; nothing merges automatically.
- **Promotional email** (`/admin/campaigns`): to opted-in customers with an email only, with an unsubscribe link in every message (unsubscribers are excluded automatically). Send a test to yourself first. Set `UNSUBSCRIBE_SECRET`.
- **Exports**: CSV, Excel (.xlsx) and PDF for orders, customers and payments (Settlements & exports page).

## Redesign (storefront and admin)
**Storefront**
- New **Gallery** (six real stills from your footage, swipe on phones, tap to enlarge with arrows) and **Details** section (only what is confirmed; fabric, weight, ankle finish and care show "To be confirmed. Ask on WhatsApp" until you tell me). New header with section links and a new footer.
- **Faster on phones and slow data**: images are now real files (the page itself is about 46 KB instead of 3.4 MB). Phones get a separate portrait sequence (31 frames per clip, 405 px) and computers an 800 px one (47 per clip). Frames load progressively: the first frame first, then every 8th, 4th and the rest, so scrolling works while the rest loads; the first frame is preloaded so the hero appears immediately. On Data Saver or 2G only every third frame loads. Files are cached for a week.
- **Search and sharing**: title, description, canonical address, Open Graph and Twitter tags (a 1200×630 share image so WhatsApp and Facebook show a proper card), Product structured data (price in naira, no invented availability or reviews), favicon and phone icon, robots.txt and sitemap.xml. Run the site (or deploy) with `SITE_URL` set: `npm run dev` / `npm run build` stamp it into the page automatically.
- To change gallery pictures, replace `public/assets/gallery/g1.webp … g6.webp` (keep the names). To replace the scroll film, replace the numbered files in `public/assets/frames/d` and `/m` (clip 1 to 4, frames 001 and up). The page text lives in `site/index.template.html`; do not edit `public/index.html`, it is regenerated.
- The structured-data price (₦20,499) in the page head is fixed text. If you change the single-jogger price in Offers & settings, update it in `site/index.template.html` too.

**Admin dashboard (rebuilt)**
New design: dark sidebar with icons and grouped sections, a slide-in menu on phones, a modern light interface with clear status badges, and tables that turn into cards on small screens. The Dashboard now greets you, shows key numbers, a "Needs attention" list and recent orders; Orders has quick status tabs; the order page is laid out as a work area (items, delivery, payments, emails and history on the left; customer, status, notes, manual payment and refund on the right); the sign-in page is redesigned.

## Storefront v3 (cart-based) and admin top bar
- **New concept**: a bold landing page (inspired by your e-bike reference) with the scroll film in a rounded black stage and numbered chapters (01/05 to 05/05), then a **shop page** (inspired by your grocery reference): product gallery with thumbnails, colour and size pickers, a quantity stepper, **Add to cart** and **Buy now**. Customers add as many joggers as they like, in any sizes and colours, from a **cart drawer**, then go to a clean two-column **checkout** with the order summary beside it.
- **Pricing is automatic and the same on screen and on the server**: one jogger = the single price; every 2 joggers = the pair price with a free gift; a leftover single = the single price; free caps unlock by total quantity (3+ = 1 cap, 5+ = 2 caps). Example with today's numbers: 1 = ₦20,499, 2 = ₦38,999, 3 = ₦59,498, 4 = ₦77,998, 5 = ₦98,497. The cart nudges customers ("Add 1 more for just ₦18,500 and get a free gift"). Change the single price, pair price, gift and cap quantities in **Offers & settings → Pricing**. Run `supabase/005_phase5.sql` once.
- **Confirmation page redesigned** (`/order/status`): a success screen with your order summary, what happens next, and buttons; a waiting screen that refreshes itself while the bank confirms; and a clear screen if payment did not go through. The cart empties after a verified payment.
- **Admin**: a desktop **top bar** (page title and date, search across orders and customers, notifications bell, light/dark switch, account menu). Search lives at `/admin/search`.
- The orders table keeps one row per order; "joggers per order" replaces the old offer buckets in the dashboard and reports.

## Latest changes
- **Admin redesign across every page**: customer profile, follow-ups, segments, notifications, inventory (colour × size grid), WhatsApp templates, emails, administrators, activity log, offers & settings, reports (charts), funnel, settlements & exports, promo email and duplicates now share one modern design with light and dark modes and phone-friendly layouts.
- **Paystack keys**: only the secret key (`sk_test_…`) is needed. The public key (`pk_…`) is not used because checkout opens Paystack's hosted payment page.
- **Card button**: "Pay securely by card" is now always visible in checkout. If card payment is not ready it tells the visitor so (and, when you are on localhost, exactly what is missing: the Paystack key or the delivery fee). Offers & settings has a **Setup status** card showing what is ready. After adding or changing `.env.local` values, restart `npm run dev`.
- **Dashboard body**: welcome header with a pill range switch (Today, 7, 30, 90 days); four KPI cards with change versus the previous period and a sparkline; a revenue (or orders) area chart; orders-by-status donut; offers-sold bars; joggers-sold-per-day bars; recent orders; and a right column with your profile and quick buttons, "Needs attention" reminders and a month calendar with dots on days that had paid orders. Staff see orders instead of revenue.
- **Light and dark**: the moon/sun button in the sidebar switches the whole admin and remembers your choice.

## Left out on purpose
Two-factor sign-in (as requested), a multi-product catalogue (single product), PostHog (replaced by the built-in funnel).

## Honest status
This code was written without access to your Supabase, Paystack or Resend accounts and has not been run against them or compiled with `npm install`. Expect to fix small issues on first run, and follow the test list above before taking real money.
