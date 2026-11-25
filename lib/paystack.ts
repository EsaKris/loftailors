const API = 'https://api.paystack.co';
const H = () => ({ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' });
export async function initTx(p: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: object }) {
  const r = await fetch(`${API}/transaction/initialize`, { method: 'POST', headers: H(), body: JSON.stringify({ email: p.email, amount: p.amountKobo, currency: 'NGN', reference: p.reference, callback_url: p.callbackUrl, metadata: p.metadata }) });
  const j = await r.json();
  if (!r.ok || !j.status) throw new Error(j.message || 'Paystack initialize failed');
  return j.data as { authorization_url: string; reference: string };
}
export async function verifyTx(reference: string) {
  const r = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers: H(), cache: 'no-store' });
  const j = await r.json();
  if (!r.ok || !j.status) throw new Error(j.message || 'Paystack verify failed');
  return j.data as { status: string; amount: number; currency: string; channel?: string; fees?: number; paid_at?: string; reference: string };
}
export async function refundTx(reference: string, amountKobo: number) {
  const r = await fetch(`${API}/refund`, { method: 'POST', headers: H(), body: JSON.stringify({ transaction: reference, amount: amountKobo }) });
  const j = await r.json();
  if (!r.ok || !j.status) throw new Error(j.message || 'Paystack refund failed');
  return j.data as { id?: number | string };
}
export async function listSettlements() {
  const r = await fetch(`${API}/settlement?perPage=100`, { headers: H(), cache: 'no-store' });
  const j = await r.json();
  if (!r.ok || !j.status) throw new Error(j.message || 'Paystack settlement list failed');
  return (j.data || []) as any[];
}
