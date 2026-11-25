'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const ICONS: Record<string, string> = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
  bag: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  heart: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z',
  pie: 'M21.2 15.9A10 10 0 118 2.8M22 12A10 10 0 0012 2v10z',
  box: 'M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4a2 2 0 001-1.7zM3.3 7L12 12l8.7-5M12 22V12',
  chat: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  wallet: 'M21 12V7a2 2 0 00-2-2H5a2 2 0 000 4h14a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7M16 14h.01',
  mail: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6',
  funnel: 'M22 3H2l8 9.5V19l4 2v-8.5z',
  copy: 'M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1',
  mega: 'M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8',
  cog: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  pulse: 'M22 12h-4l-3 9L9 3l-3 9H2',
  search: 'M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z',
  menu: 'M3 12h18M3 6h18M3 18h18',
  x: 'M18 6L6 18M6 6l12 12',
  sun: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  out: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
};
export const Icon = ({ n, size = 18 }: { n: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[n]} /></svg>
);
export type NavGroup = { label: string; items: { href: string; label: string; icon: string; badge?: number }[] };

export default function Nav({ groups, name, role }: { groups: NavGroup[]; name: string; role: string }) {
  const path = usePathname() || '';
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);
  const active = (h: string) => (h === '/admin' ? path === '/admin' : path.startsWith(h));
  return (
    <>
      <header className="topbar">
        <button className="iconbtn" aria-label="Open menu" onClick={() => setOpen(true)}><Icon n="menu" size={22} /></button>
        <span className="brand">LOFT</span><span className="role">{role}</span>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`side${open ? ' open' : ''}`}>
        <div className="sidehead"><span className="brand">LOFT</span><button className="iconbtn only-m" aria-label="Close menu" onClick={() => setOpen(false)}><Icon n="x" size={22} /></button></div>
        <nav>
          {groups.map(g => (
            <div key={g.label} className="grp"><div className="glabel">{g.label}</div>
              {g.items.map(i => (
                <Link key={i.href} href={i.href} className={`nav${active(i.href) ? ' on' : ''}`}><Icon n={i.icon} /><span>{i.label}</span>{!!i.badge && <em>{i.badge > 99 ? '99+' : i.badge}</em>}</Link>
              ))}
            </div>))}
        </nav>
        <form method="post" action="/api/admin/logout" className="me">
          <div className="av">{name.slice(0, 1).toUpperCase()}</div><div className="who"><b>{name}</b><small>{role === 'super' ? 'Super Admin' : 'Staff'}</small></div>
          <button className="iconbtn" aria-label="Sign out" title="Sign out" style={{ marginLeft: 0 }}><Icon n="out" /></button>
        </form>
      </aside>
    </>
  );
}
