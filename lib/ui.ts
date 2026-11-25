export const pay = (s: string) => (s === 'successful' ? 'ok' : s === 'pending' ? 'warn' : s === 'refunded' || s === 'partially_refunded' ? 'info' : 'bad');
export const stat = (s: string) => (['delivered'].includes(s) ? 'ok' : ['cancelled', 'refunded'].includes(s) ? 'bad' : ['new', 'payment_pending'].includes(s) ? 'warn' : 'info');
export const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
export const lagos = (d: string) => new Date(d).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const greeting = () => { const h = (new Date().getUTCHours() + 1) % 24; return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
