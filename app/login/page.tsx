export const metadata = { title: 'Sign in — LOFT Admin' };
export default function Login({ searchParams }: { searchParams: { e?: string } }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(70% 60% at 50% 0,#26231b,#0e0e10)' }}>
      <form method="post" action="/api/admin/login" className="card" style={{ width: 'min(400px,100%)', padding: 30, display: 'grid', gap: 14 }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}><div className="brand" style={{ fontSize: 20 }}>LOFT</div><small>Admin sign in</small></div>
        <label><small>Email</small><input name="email" type="email" required autoComplete="username" style={{ width: '100%' }} /></label>
        <label><small>Password</small><input name="password" type="password" required autoComplete="current-password" style={{ width: '100%' }} /></label>
        {searchParams.e && <p className="pill bad" style={{ margin: 0, justifyContent: 'center' }}>Sign-in failed. Check your details.</p>}
        <button className="btn" style={{ width: '100%' }}>Sign in</button>
        <div style={{ textAlign: 'center' }}><a href="/forgot-password" style={{ color: 'inherit', fontSize: 13, textDecoration: 'underline' }}>Forgot your password?</a></div>
      </form>
    </main>
  );
}
