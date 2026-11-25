import { db } from '@/lib/db';
import { requireSuper, PERMS, can } from '@/lib/auth';
import { Head, Avatar, Flash } from '@/components/ui';

export default async function Administrators({ searchParams }: { searchParams: { msg?: string } }) {
  const me = await requireSuper();
  const { data: admins } = await db.from('administrators').select('*').order('created_at');
  const { data: u } = await db.auth.admin.listUsers({ perPage: 200 });
  const email = (id: string) => u?.users.find(x => x.id === id)?.email || '';
  const Perms = ({ a }: { a?: any }) => <div className="actions" style={{ margin: '12px 0' }}>{Object.entries(PERMS).map(([k, l]) => <label key={k} className="tg"><input type="checkbox" name={`p_${k}`} defaultChecked={a ? can(a, k) : k !== 'export_orders'} />{l}</label>)}</div>;
  return (
    <>
      <Head title="Administrators" sub="Who can sign in, and what staff are allowed to do." />
      <Flash msg={searchParams.msg} />
      <div className="grid2">
        {(admins || []).map((a: any) => (
          <div key={a.id} className="card">
            <div className="person"><Avatar name={a.name} /><div style={{ flex: 1, minWidth: 0 }}><b>{a.name}</b><br /><small>{email(a.id)}</small></div><span className={`pill ${a.role === 'super' ? 'info' : ''}`}>{a.role === 'super' ? 'Super Admin' : 'Staff'}</span></div>
            {!a.active && <p><span className="pill bad">Deactivated</span></p>}
            {a.role === 'staff' && <form method="post" action="/api/admin/administrators"><input type="hidden" name="do" value="perms" /><input type="hidden" name="id" value={a.id} /><Perms a={a} /><button className="btn">Save permissions</button></form>}
            {a.id !== me.id && <form method="post" action="/api/admin/administrators" style={{ marginTop: 12 }}><input type="hidden" name="do" value="toggle" /><input type="hidden" name="id" value={a.id} /><button className="btn alt">{a.active ? 'Deactivate sign-in' : 'Reactivate sign-in'}</button></form>}
          </div>))}
        <form className="card" method="post" action="/api/admin/administrators"><h2>Add a staff member</h2><input type="hidden" name="do" value="create" />
          <div className="stack"><label className="fld"><span>Full name</span><input name="name" required /></label><label className="fld"><span>Email</span><input name="email" type="email" required /></label><label className="fld"><span>Temporary password (10+ characters)</span><input name="password" minLength={10} required /></label></div>
          <Perms /><button className="btn">Create staff account</button>
          <p className="muted" style={{ marginBottom: 0 }}>Staff never see revenue, refunds, settlements, settings or this page, whatever is ticked.</p></form>
      </div>
    </>
  );
}
