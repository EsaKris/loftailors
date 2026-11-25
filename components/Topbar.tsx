'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './Nav';

const TITLES: [string, string][] = [['/admin/orders', 'Orders'], ['/admin/customers', 'Customers'], ['/admin/followups', 'Follow-ups'], ['/admin/segments', 'Segments'], ['/admin/duplicates', 'Duplicates'], ['/admin/inventory', 'Inventory'], ['/admin/templates', 'WhatsApp templates'], ['/admin/emails', 'Email notifications'], ['/admin/campaigns', 'Promo email'], ['/admin/reports', 'Reports'], ['/admin/funnel', 'Funnel'], ['/admin/settlements', 'Settlements & exports'], ['/admin/settings', 'Offers & settings'], ['/admin/administrators', 'Administrators'], ['/admin/activity', 'Activity log'], ['/admin/notifications', 'Notifications'], ['/admin/search', 'Search'], ['/admin', 'Dashboard']];
export default function Topbar({ name, role, unread, date }: { name: string; role: string; unread: number; date: string }) {
  const path = usePathname() || '';
  const title = (TITLES.find(([p]) => path.startsWith(p)) || ['', 'Admin'])[1];
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === 'dark'), []);
  const flip = () => { const n = !dark; setDark(n); document.documentElement.dataset.theme = n ? 'dark' : 'light'; try { localStorage.setItem('loft_theme', n ? 'dark' : 'light'); } catch {} };
  return (
    <header className="topnav">
      <div className="tn-title"><b>{title}</b><small>{date}</small></div>
      <form className="tn-search" action="/admin/search" role="search">
        <Icon n="search" size={18} /><input name="q" placeholder="Search orders, customers, phone numbers…" aria-label="Search" autoComplete="off" />
      </form>
      <div className="tn-right">
        <Link href="/admin/orders" className="btn tn-cta">View orders</Link>
        <Link href="/admin/notifications" className="tn-ic" aria-label="Notifications"><Icon n="bell" size={20} />{unread > 0 && <em>{unread > 99 ? '99+' : unread}</em>}</Link>
        <button type="button" className="tn-ic" aria-label="Switch light or dark" onClick={flip}><Icon n={dark ? 'sun' : 'moon'} size={20} /></button>
        <details className="tn-me">
          <summary aria-label="Account menu"><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><span className="tn-who"><b>{name}</b><small>{role === 'super' ? 'Super Admin' : 'Staff'}</small></span></summary>
          <div className="tn-menu">
            <Link href="/admin/notifications">Notifications</Link>
            <Link href="/" target="_blank">View storefront</Link>
            <form method="post" action="/api/admin/logout"><button>Sign out</button></form>
          </div>
        </details>
      </div>
    </header>
  );
}
