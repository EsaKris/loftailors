import crypto from 'crypto';
const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'x';
export const unsubToken = (customerId: string) => crypto.createHmac('sha256', secret()).update(customerId).digest('hex').slice(0, 32);
export const unsubLink = (customerId: string) => `${process.env.SITE_URL}/unsubscribe?c=${customerId}&t=${unsubToken(customerId)}`;
export const unsubValid = (id: string, t: string) => t.length === 32 && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(unsubToken(id)));
