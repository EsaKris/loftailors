import Link from 'next/link';
import { Icon } from './Nav';
export const Head = ({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) => (
  <div className="pagehead"><div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>{children && <div className="actions">{children}</div>}</div>
);
export const Empty = ({ icon, title, text }: { icon: string; title: string; text?: string }) => (
  <div className="empty"><span className="ic v"><Icon n={icon} size={22} /></span><b>{title}</b>{text && <p>{text}</p>}</div>
);
export const Tile = ({ icon, cls = 'v', label, value, hint, href, sel }: { icon: string; cls?: string; label: string; value: string | number; hint?: string; href?: string; sel?: boolean }) => {
  const inner = <><span className={`ic ${cls}`}><Icon n={icon} size={20} /></span><small>{label}</small><b>{value}</b>{hint && <span className="hint">{hint}</span>}</>;
  return href ? <Link href={href} className={`card tile${sel ? ' sel' : ''}`}>{inner}</Link> : <div className={`card tile${sel ? ' sel' : ''}`}>{inner}</div>;
};
export const Flash = ({ msg }: { msg?: string }) => (msg ? <p className="flash">{msg}</p> : null);
export const Avatar = ({ name, lg }: { name: string; lg?: boolean }) => <span className={`avatar${lg ? ' lg' : ''}`}>{(name || '?').slice(0, 1).toUpperCase()}</span>;
