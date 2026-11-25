import { naira } from './offers';
export const fill = (body: string, v: Record<string, string>) => body.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? '').replace(/ {2,}/g, ' ').trim();
export function varsFor(c: any, o?: any): Record<string, string> {
  const v: Record<string, string> = { customer_name: c.full_name.split(' ')[0] };
  if (o) Object.assign(v, {
    order_number: o.order_number, order_amount: naira(o.total_kobo), payment_status: o.payment_status,
    delivery_status: o.order_status.replace(/_/g, ' '), delivery_address: [o.delivery_address, o.city, o.state].filter(Boolean).join(', '),
    product_name: 'LOFT Joggers',
    tracking_info: [o.courier && `Courier: ${o.courier}.`, o.tracking_number && `Tracking: ${o.tracking_number}.`, o.tracking_url, o.estimated_delivery && `Expected: ${o.estimated_delivery}.`].filter(Boolean).join(' '),
  });
  return v;
}
