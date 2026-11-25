import { createSign } from 'node:crypto';
import { db } from './db';

// Direct, private Google Sheets API backup. This module is server-only.
export const SHEET_HEADERS = [
  'Event', 'Order Number', 'Placed At', 'Channel', 'Customer Name', 'Phone', 'Email',
  'Delivery Address', 'City', 'State', 'Items', 'Offer', 'Free Items', 'Total (NGN)',
  'Payment Status', 'Marketing Consent', 'Customer Note',
];

const configured = () => !!(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  process.env.GOOGLE_PRIVATE_KEY &&
  process.env.GOOGLE_SHEET_ID
);
export const sheetsEnabled = configured;

let cachedToken: { value: string; expiresAt: number } | null = null;
const b64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(key, 'base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(10000),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(`Google authentication failed: ${payload.error_description || payload.error || response.status}`);
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

const tab = () => (process.env.GOOGLE_SHEET_TAB || 'Sheet1').replace(/'/g, "''");
const range = (a1: string) => `'${tab()}'!${a1}`;
async function sheetsRequest(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(process.env.GOOGLE_SHEET_ID!)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Google Sheets returned ${response.status}`);
  return payload;
}

async function ensureHeaders() {
  const headerRange = range('A1:Q1');
  const result = await sheetsRequest(`/values/${encodeURIComponent(headerRange)}`);
  const current: string[] = result.values?.[0] || [];
  if (!current.length) {
    await sheetsRequest(`/values/${encodeURIComponent(headerRange)}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ majorDimension: 'ROWS', values: [SHEET_HEADERS] }),
    });
    return;
  }
  const matches = SHEET_HEADERS.every((header, i) => String(current[i] || '').trim().toLowerCase() === header.toLowerCase());
  if (!matches) throw new Error('The first row of the Google Sheet must contain the 17 LOFT backup headings in the order shown in the setup guide.');
}

async function findOrderRow(orderNumber: string): Promise<number | null> {
  const params = new URLSearchParams({ majorDimension: 'ROWS' });
  const result = await sheetsRequest(`/values/${encodeURIComponent(range('B:B'))}?${params.toString()}`);
  const rows: any[][] = result.values || [];
  const index = rows.findIndex((r, i) => i > 0 && String(r[0] || '').trim() === orderNumber);
  return index >= 0 ? index + 1 : null;
}

async function writeOrderRow(values: string[], orderNumber: string) {
  await ensureHeaders();
  const existingRow = await findOrderRow(orderNumber);
  if (existingRow) {
    // A delayed ORDER_CREATED retry must never downgrade a row already marked PAID.
    const existingRange = range(`A${existingRow}:Q${existingRow}`);
    const existing = await sheetsRequest(`/values/${encodeURIComponent(existingRange)}`);
    if (existing.values?.[0]?.[0] === 'PAID' && values[0] !== 'PAID') return;
    const target = existingRange;
    await sheetsRequest(`/values/${encodeURIComponent(target)}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ majorDimension: 'ROWS', values: [values] }),
    });
    return;
  }
  const target = range('A:Q');
  await sheetsRequest(`/values/${encodeURIComponent(target)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST', body: JSON.stringify({ majorDimension: 'ROWS', values: [values] }),
  });
}

async function valuesFor(orderId: string, event: string): Promise<string[]> {
  const { data: o, error } = await db.from('orders').select('*, customers(*), order_items(*)').eq('id', orderId).single();
  if (error || !o) throw new Error('Order not found for Google Sheets backup');
  const c = o.customers || {};
  return [
    event === 'ORDER_CREATED' && o.payment_status === 'successful' ? 'PAID' : event,
    String(o.order_number || ''),
    new Date(o.created_at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
    String(o.channel || ''),
    String(c.full_name || ''),
    String(c.phone_e164 || ''),
    String(c.email || ''),
    String(o.delivery_address || ''),
    String(o.city || ''),
    String(o.state || ''),
    (o.order_items || []).map((i: any, n: number) => `${n + 1}. ${i.colour} ${i.size}`).join(' | '),
    `${o.pack_qty} joggers`,
    String(o.free_items || ''),
    String(Number(o.total_kobo || 0) / 100),
    String(o.payment_status || ''),
    c.marketing_consent ? 'yes' : 'no',
    String(o.customer_note || ''),
  ];
}

async function sendRow(orderId: string, event: string) {
  try {
    const values = await valuesFor(orderId, event);
    await writeOrderRow(values, values[1]);
    await db.from('backup_log').update({ status: 'sent', last_error: null, updated_at: new Date().toISOString() }).eq('order_id', orderId).eq('event', event);
  } catch (e: any) {
    const { data: log } = await db.from('backup_log').select('attempts').eq('order_id', orderId).eq('event', event).single();
    await db.from('backup_log').update({ status: 'failed', attempts: (log?.attempts ?? 0) + 1, last_error: String(e?.message || e).slice(0, 200), updated_at: new Date().toISOString() }).eq('order_id', orderId).eq('event', event);
    console.error('Google Sheets backup failed:', e);
  }
}

// Best-effort: never makes checkout or payment settlement fail because Google is unavailable.
export async function backupOrder(orderId: string, event: 'ORDER_CREATED' | 'PAID') {
  try {
    if (!sheetsEnabled()) return;
    const { error } = await db.from('backup_log').insert({ order_id: orderId, event });
    if (error) {
      // A duplicate log row means this event has already been queued/sent; don't create another.
      if (error.code !== '23505') console.error('Could not queue Google Sheets backup:', error.message);
      return;
    }
    await sendRow(orderId, event);
  } catch (e) { console.error('Google Sheets backup error:', e); }
}

export async function retryBackups() {
  if (!sheetsEnabled()) return 0;
  const { data, error } = await db.from('backup_log').select('order_id, event').in('status', ['failed', 'queued']).lt('attempts', 5).limit(50);
  if (error) throw new Error(`Could not load backup queue: ${error.message}`);
  for (const row of data || []) await sendRow(row.order_id, row.event);
  return data?.length ?? 0;
}

export async function sendTestEntry() {
  if (!sheetsEnabled()) throw new Error('Google Sheets backup is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_SHEET_ID.');
  const values = [
    'TEST', 'TEST-ENTRY', new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }), 'test',
    'Test Customer', '+2340000000000', 'test@example.com', 'Test address', 'Makurdi', 'Benue',
    '1. Black M', '1 jogger', '', '0', 'test', 'no', 'Safe to delete',
  ];
  await writeOrderRow(values, 'TEST-ENTRY');
}
