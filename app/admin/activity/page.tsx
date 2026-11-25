import { db } from '@/lib/db';
import { requireSuper } from '@/lib/auth';
import { lagos } from '@/lib/ui';
import { Head, Empty } from '@/components/ui';
export default async function Activity() {
  await requireSuper();
  const { data } = await db.from('admin_activity_logs').select('*, administrators(name)').order('created_at', { ascending: false }).limit(200);
  return (
    <>
      <Head title="Activity log" sub="The last 200 changes made by your team." />
      <div className="scroll"><table className="rt"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>
        {(data || []).map((l: any) => <tr key={l.id}><td data-label="When">{lagos(l.created_at)}</td><td data-label="Who">{l.administrators?.name || '—'}</td><td data-label="Action"><span className="pill info">{l.action}</span></td><td data-label="Detail">{[l.entity, l.entity_id, l.detail].filter(Boolean).join(' · ')}</td></tr>)}
        {!data?.length && <tr><td colSpan={4}><Empty icon="pulse" title="Nothing logged yet" /></td></tr>}</tbody></table></div>
    </>
  );
}
