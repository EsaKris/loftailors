import Link from 'next/link';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { lagos } from '@/lib/ui';
import { Icon } from '@/components/Nav';
import { Head, Empty } from '@/components/ui';

const ICON: Record<string, [string, string]> = { order: ['bag', 'v'], payment: ['wallet', 'k'], stock: ['box', 'o'], refund: ['wallet', 'g'] };
export default async function Notifications() {
  await requireAdmin();
  const { data } = await db.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
  const unread = (data || []).filter((n: any) => !n.read_at).length;
  return (
    <>
      <Head title="Notifications" sub={unread ? `${unread} unread` : 'You are all caught up.'}>{unread > 0 && <form method="post" action="/api/admin/notifications"><button className="btn alt">Mark all as read</button></form>}</Head>
      <div className="card" style={{ padding: '6px 20px' }}>
        {(data || []).map((n: any) => { const [ic, c] = ICON[n.type] || ['bell', 'v']; return (
          <div key={n.id} className={`notif${n.read_at ? '' : ' unread'}`}>
            <span className={`ic ${c}`}><Icon n={ic} size={20} /></span>
            <div className="body"><div className="t">{n.title}</div>{n.body && <div className="muted">{n.body}</div>}<small>{lagos(n.created_at)}</small>{n.link && <> · <Link href={n.link}>Open</Link></>}</div>
            {!n.read_at ? <form method="post" action="/api/admin/notifications" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="dot" /><input type="hidden" name="id" value={n.id} /><button className="btn alt" style={{ minHeight: 32, padding: '0 12px', fontSize: 12 }}>Mark read</button></form> : null}
          </div>); })}
        {!data?.length && <Empty icon="bell" title="No notifications yet" text="New orders, payments, low stock and refunds will show up here." />}
      </div>
    </>
  );
}
