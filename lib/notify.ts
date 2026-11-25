import { db } from './db';
// Never throws. dedupe_key (unique) stops the same event notifying twice.
export async function notify(type: string, title: string, body?: string, link?: string, key?: string) {
  try { await db.from('notifications').insert({ type, title, body: body ?? null, link: link ?? null, dedupe_key: key ?? null }); } catch {}
}
export async function logActivity(adminId: string | null, action: string, entity?: string, entityId?: string, detail?: string) {
  try { await db.from('admin_activity_logs').insert({ admin_id: adminId, action, entity: entity ?? null, entity_id: entityId ?? null, detail: detail?.slice(0, 300) ?? null }); } catch {}
}
