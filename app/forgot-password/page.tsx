'use client';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage(''); setError('');
    try {
      const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send the recovery email.');
      setMessage(data.message || 'If an account exists for that email, a recovery link has been sent.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(70% 60% at 50% 0,#26231b,#0e0e10)' }}>
    <form onSubmit={submit} className="card" style={{ width: 'min(420px,100%)', padding: 30, display: 'grid', gap: 14 }}>
      <div style={{ textAlign: 'center', marginBottom: 6 }}><div className="brand" style={{ fontSize: 20 }}>LOFT</div><small>Reset your admin password</small></div>
      <p style={{ margin: 0, fontSize: 13, opacity: .8 }}>Enter the email address associated with your admin account. If an account exists, we'll send a recovery link.</p>
      <label><small>Email</small><input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%' }} /></label>
      {message && <p role="status" className="pill" style={{ margin: 0 }}>{message}</p>}
      {error && <p role="alert" className="pill bad" style={{ margin: 0 }}>{error}</p>}
      <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Sending…' : 'Send recovery link'}</button>
      <div style={{ textAlign: 'center' }}><a href="/login" style={{ color: 'inherit', fontSize: 13, textDecoration: 'underline' }}>Back to sign in</a></div>
    </form>
  </main>;
}
