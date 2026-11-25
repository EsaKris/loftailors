import { db } from '@/lib/db';
import { unsubValid } from '@/lib/unsub';
export const dynamic = 'force-dynamic';
export default async function Unsub({ searchParams }: { searchParams: { c?: string; t?: string } }) {
  const ok = !!searchParams.c && !!searchParams.t && /^[0-9a-f-]{36}$/.test(searchParams.c) && unsubValid(searchParams.c, searchParams.t);
  if (ok) await db.from('customers').update({ marketing_consent: false, opted_out_at: new Date().toISOString() }).eq('id', searchParams.c!);
  return (
    <main style={{ maxWidth: 480, margin: '16vh auto', padding: 22, textAlign: 'center' }}>
      <h1 style={{ letterSpacing: '.3em' }}>LOFT</h1>
      <p>{ok ? 'You have been unsubscribed from LOFT promotional messages. You will still receive messages about any orders you place.' : 'This unsubscribe link is not valid.'}</p>
    </main>
  );
}
