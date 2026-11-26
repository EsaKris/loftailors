'use client';
import { useEffect, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
function supabaseBrowser() {
  if (!browserClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase browser configuration is missing.');
    browserClient = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  }
  return browserClient;
}
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false), [valid, setValid] = useState(false);
  const [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  useEffect(() => {
    let active = true;
    try {
      const client = supabaseBrowser();
      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (active && event === 'PASSWORD_RECOVERY' && session) setValid(true);
      });
      client.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        const recovery = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
        if (!sessionError && data.session && recovery) setValid(true);
        setReady(true);
      }).catch(() => { if (active) setReady(true); });
      return () => { active = false; listener.subscription.unsubscribe(); };
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not initialize recovery.'); setReady(true); }
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setSuccess('');
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) throw error;
      await supabaseBrowser().auth.signOut();
      setSuccess('Your password has been updated. Please sign in with your new password.');
      setValid(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update your password. Request a fresh recovery email.'); }
    finally { setBusy(false); }
  }
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(70% 60% at 50% 0,#26231b,#0e0e10)' }}>
    <section className="card" style={{ width: 'min(420px,100%)', padding: 30, display: 'grid', gap: 14 }}>
      <div style={{ textAlign: 'center', marginBottom: 6 }}><div className="brand" style={{ fontSize: 20 }}>LOFT</div><small>Choose a new admin password</small></div>
      {!ready && <p role="status">Checking your recovery link…</p>}
      {ready && valid && <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <label><small>New password</small><input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%' }} /></label>
        <label><small>Confirm new password</small><input type="password" required minLength={10} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} style={{ width: '100%' }} /></label>
        <small>Use at least 10 characters.</small>
        <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Updating…' : 'Update password'}</button>
      </form>}
      {ready && !valid && !success && <p role="alert">This recovery link is invalid, expired, or already used. Request a fresh link to continue.</p>}
      {error && <p role="alert" className="pill bad" style={{ margin: 0 }}>{error}</p>}
      {success && <p role="status" className="pill" style={{ margin: 0 }}>{success}</p>}
      <div style={{ textAlign: 'center' }}><a href="/login" style={{ color: 'inherit', fontSize: 13, textDecoration: 'underline' }}>Back to sign in</a></div>
    </section>
  </main>;
}
