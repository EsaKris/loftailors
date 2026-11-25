import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
export type Admin = { id: string; name: string; role: 'super' | 'staff'; permissions: Record<string, boolean>; active: boolean };
export const PERMS: Record<string, string> = { manage_orders: 'Update orders and delivery details', view_customers: 'View customers, follow-ups and segments', whatsapp: 'Use WhatsApp buttons', view_inventory: 'View inventory', export_orders: 'Export orders (no money columns)' };
const DEFAULTS: Record<string, boolean> = { manage_orders: true, view_customers: true, whatsapp: true, view_inventory: true, export_orders: false };
export const can = (a: Admin, p: string) => a.role === 'super' || (a.permissions?.[p] ?? DEFAULTS[p] ?? false);
export async function getAdmin(): Promise<Admin | null> {
  const t = cookies().get('sb-at')?.value;
  if (!t) return null;
  const { data: { user } } = await db.auth.getUser(t);
  if (!user) return null;
  const { data } = await db.from('administrators').select('id,name,role,permissions,active').eq('id', user.id).maybeSingle();
  return data && data.active ? (data as Admin) : null;
}
export async function requireAdmin(): Promise<Admin> { const a = await getAdmin(); if (!a) redirect('/login'); return a; }
export async function requireCan(p: string): Promise<Admin> { const a = await requireAdmin(); if (!can(a, p)) redirect('/admin'); return a; }
export async function requireSuper(): Promise<Admin> { const a = await requireAdmin(); if (a.role !== 'super') redirect('/admin'); return a; }
