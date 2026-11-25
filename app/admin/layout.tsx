import { requireAdmin, can } from '@/lib/auth';
import { db } from '@/lib/db';
import Nav, { type NavGroup } from '@/components/Nav';
import Topbar from '@/components/Topbar';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'LOFT Admin', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const a = await requireAdmin();
  const { count: unread } = await db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  const su = a.role === 'super', cust = can(a, 'view_customers');
  const groups: NavGroup[] = [
    { label: 'Overview', items: [{ href: '/admin', label: 'Dashboard', icon: 'grid' }, { href: '/admin/notifications', label: 'Notifications', icon: 'bell', badge: unread || 0 }] },
    { label: 'Sell', items: [{ href: '/admin/orders', label: 'Orders', icon: 'bag' }, ...(can(a, 'view_inventory') ? [{ href: '/admin/inventory', label: 'Inventory', icon: 'box' }] : []), ...(su ? [{ href: '/admin/settings', label: 'Offers & settings', icon: 'cog' }] : [])] },
    ...(cust ? [{ label: 'Customers', items: [{ href: '/admin/customers', label: 'Customers', icon: 'users' }, { href: '/admin/followups', label: 'Follow-ups', icon: 'heart' }, { href: '/admin/segments', label: 'Segments', icon: 'pie' }, ...(su ? [{ href: '/admin/duplicates', label: 'Duplicates', icon: 'copy' }] : [])] }] : []),
    { label: 'Messages', items: [{ href: '/admin/templates', label: 'WhatsApp templates', icon: 'chat' }, ...(su ? [{ href: '/admin/emails', label: 'Email notifications', icon: 'mail' }, { href: '/admin/campaigns', label: 'Promo email', icon: 'mega' }] : [])] },
    ...(su ? [{ label: 'Business', items: [{ href: '/admin/reports', label: 'Reports', icon: 'chart' }, { href: '/admin/funnel', label: 'Funnel', icon: 'funnel' }, { href: '/admin/settlements', label: 'Settlements & exports', icon: 'wallet' }] }, { label: 'Team', items: [{ href: '/admin/administrators', label: 'Administrators', icon: 'shield' }, { href: '/admin/activity', label: 'Activity log', icon: 'pulse' }] }] : []),
  ];
  const date = new Date(Date.now() + 3600e3).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return <div className="app"><Nav groups={groups} name={a.name} role={a.role} /><div className="col"><Topbar name={a.name} role={a.role} unread={unread || 0} date={date} /><main className="pg">{children}</main></div></div>;
}
