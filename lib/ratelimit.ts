// Simple per-instance limiter. On serverless each instance has its own memory, so this blunts abuse but is not a hard guarantee.
// For a strict limit, swap this for Upstash Redis rate limiting.
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number) {
  const now = Date.now(), a = (hits.get(key) || []).filter(t => now - t < windowMs);
  a.push(now); hits.set(key, a);
  if (hits.size > 5000) hits.clear();
  return a.length > max;
}
// Vercel sets these itself, so a visitor cannot fake them. Falls back to the first x-forwarded-for entry elsewhere.
export const ipOf = (req: Request) => (req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim();
