import { settlePayment } from '@/lib/settle';
import { db } from '@/lib/db';
import { naira } from '@/lib/offers';
import AutoRefresh from '@/components/AutoRefresh';
import ClearCart from '@/components/ClearCart';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your LOFT order' };

const STEPS = ['Order confirmed', 'Being prepared', 'On its way', 'Delivered'];
// Paystack sends the customer here. The page asks Paystack (server-side) for the truth; the address alone proves nothing.
export default async function Status({ searchParams }: { searchParams: { reference?: string; trxref?: string } }) {
  const ref = searchParams.reference || searchParams.trxref;
  let status = 'unknown';
  if (ref) { try { status = (await settlePayment(ref)).status; } catch { status = 'error'; } }
  const { data } = ref ? await db.from('payments').select('orders(order_number,subtotal_kobo,delivery_kobo,total_kobo,free_items,city,state,customers(full_name),order_items(size,colour))').eq('reference', ref).maybeSingle() : { data: null };
  const o: any = (data as any)?.orders;
  const ok = status === 'successful', wait = status === 'pending';
  const first = (o?.customers?.full_name || '').split(' ')[0];
  const title = ok ? (first ? `Thank you, ${first}!` : 'Thank you!') : wait ? 'Confirming your payment' : status === 'error' ? 'We could not confirm yet' : 'Payment not completed';
  const text = ok ? 'Your payment is confirmed and your order is with us. A confirmation email is on its way if you gave an email address.'
    : wait ? 'Your bank is still confirming the payment. This page will refresh by itself; you do not need to pay again.'
    : status === 'error' ? 'We could not reach the payment service. If your account was debited, message us on WhatsApp with your order number and we will sort it out.'
    : 'Your payment did not go through and you have not been charged for this order. You can try again.';
  return (
    <main className="cf">
      <style>{CSS}</style>
      {wait && <AutoRefresh />}
      {ok && <ClearCart />}
      <a href="/" className="cf-logo"><img src="/assets/img/logo.webp" alt="" width="34" height="34" />LOFT</a>
      <section className="cf-hero">
        <div className={`cf-badge ${ok ? 'ok' : wait ? 'wait' : 'bad'}`}>{ok ? <svg viewBox="0 0 52 52" width="52" height="52"><path className="tick" d="M14 27l8 8 16-17" fill="none" stroke="#0a0a0a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg> : wait ? <span className="spin" /> : <svg viewBox="0 0 52 52" width="44" height="44"><path d="M16 16l20 20M36 16L16 36" stroke="#fff" strokeWidth="5" strokeLinecap="round" /></svg>}</div>
        <h1>{title}</h1><p>{text}</p>
        {o && <span className="cf-ref">Order <b>{o.order_number}</b></span>}
      </section>
      {o && (
        <section className="cf-grid">
          <div className="cf-card">
            <h2>Your order</h2>
            {o.order_items.map((i: any, n: number) => (
              <div key={n} className="cf-item"><img src="/assets/img/front.webp" alt="" width="56" height="62" /><div><b>LOFT Joggers</b><span>{i.colour} · Size {i.size}</span></div><em>×1</em></div>))}
            {o.free_items && <div className="cf-free">Free with your order: {o.free_items}</div>}
            <dl><div><dt>Items</dt><dd>{naira(o.subtotal_kobo)}</dd></div><div><dt>Delivery</dt><dd>{o.delivery_kobo ? naira(o.delivery_kobo) : 'Included'}</dd></div><div className="t"><dt>Total paid</dt><dd>{naira(o.total_kobo)}</dd></div></dl>
            <p className="cf-small">Delivering to {[o.city, o.state].filter(Boolean).join(', ')}.</p>
          </div>
          <div className="cf-card dark">
            <h2>What happens next</h2>
            <ol>{STEPS.map((s, i) => <li key={s} className={i === 0 && ok ? 'done' : ''}><span>{i === 0 && ok ? '✓' : i + 1}</span><div><b>{s}</b><small>{['We have your order and payment.', 'We pack your joggers and any free gifts.', 'We message you when it is dispatched.', 'Enjoy your new joggers.'][i]}</small></div></li>)}</ol>
          </div>
        </section>)}
      <section className="cf-actions">
        <a className="cf-btn lime" href={ok ? '/' : '/#shop'}>{ok ? 'Continue shopping' : 'Try again'}</a>
        <a className="cf-btn line" href={`https://wa.me/2348065170300?text=${encodeURIComponent(o ? `Hello LOFT, about my order ${o.order_number}.` : 'Hello LOFT, I need help with my order.')}`}>Message LOFT on WhatsApp</a>
      </section>
    </main>
  );
}
const CSS = `
.cf{min-height:100vh;background:#fff;color:#0a0a0a;padding:22px clamp(18px,4vw,56px) 70px;font-family:Inter,system-ui,sans-serif}
.cf *{box-sizing:border-box}.cf-logo{display:inline-flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.32em;font-size:13px;text-decoration:none;color:#0a0a0a}.cf-logo img{border-radius:50%}
.cf-hero{text-align:center;max-width:640px;margin:44px auto 40px}.cf-hero h1{font-size:clamp(34px,6vw,60px);font-weight:800;letter-spacing:-.04em;line-height:1.02;margin:22px 0 12px}.cf-hero p{color:#5b5b55;margin:0 auto;max-width:520px;font-size:16px;line-height:1.6}
.cf-badge{width:96px;height:96px;border-radius:50%;margin:0 auto;display:grid;place-items:center}.cf-badge.ok{background:#d7f545;animation:pop .6s cubic-bezier(.2,1.4,.4,1)}.cf-badge.wait{background:#f0f0ea}.cf-badge.bad{background:#e5484d}
.tick{stroke-dasharray:60;stroke-dashoffset:60;animation:draw .6s .35s ease forwards}@keyframes draw{to{stroke-dashoffset:0}}@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
.spin{width:38px;height:38px;border-radius:50%;border:4px solid #d9d9d2;border-top-color:#0a0a0a;animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
.cf-ref{display:inline-block;margin-top:20px;background:#f4f4ef;border-radius:99px;padding:9px 18px;font-size:14px}
.cf-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:18px;max-width:1000px;margin:0 auto}.cf-card{background:#f6f6f1;border-radius:28px;padding:28px}.cf-card.dark{background:#0a0a0a;color:#fff}
.cf-card h2{font-size:20px;font-weight:700;letter-spacing:-.02em;margin:0 0 18px}
.cf-item{display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid #e3e3db}.cf-item img{border-radius:12px;object-fit:cover;background:#e8e8e2}.cf-item div{flex:1}.cf-item b{display:block}.cf-item span{color:#6a6a63;font-size:14px}.cf-item em{font-style:normal;color:#6a6a63}
.cf-free{margin:14px 0;background:#d7f545;border-radius:14px;padding:11px 14px;font-weight:600;font-size:14px}
.cf-card dl{margin:14px 0 0}.cf-card dl div{display:flex;justify-content:space-between;padding:7px 0}.cf-card dt{color:#6a6a63}.cf-card dd{margin:0}.cf-card .t{border-top:1px solid #dcdcd3;margin-top:6px;padding-top:14px;font-size:18px;font-weight:700}.cf-card .t dt{color:#0a0a0a}
.cf-small{color:#6a6a63;font-size:13px;margin:12px 0 0}
.cf-card ol{list-style:none;margin:0;padding:0;display:grid;gap:20px}.cf-card li{display:flex;gap:14px;align-items:flex-start}.cf-card li>span{width:34px;height:34px;border-radius:50%;background:#26261f;display:grid;place-items:center;font-weight:700;flex:none}.cf-card li.done>span{background:#d7f545;color:#0a0a0a}
.cf-card li b{display:block}.cf-card li small{color:#a5a59c;font-size:13.5px}
.cf-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:34px}
.cf-btn{display:inline-flex;align-items:center;justify-content:center;min-height:54px;padding:0 30px;border-radius:99px;font-weight:700;text-decoration:none;font-size:15px}.cf-btn.lime{background:#d7f545;color:#0a0a0a}.cf-btn.line{border:1.5px solid #0a0a0a;color:#0a0a0a}
@media(max-width:760px){.cf-grid{grid-template-columns:1fr}.cf-card{padding:22px;border-radius:24px}.cf-btn{width:100%}}
`;
