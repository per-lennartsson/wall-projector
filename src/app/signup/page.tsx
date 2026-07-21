'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Signup failed');
      setBusy(false);
      return;
    }

    const result = await signIn('credentials', { email, password, redirect: false });
    setBusy(false);
    if (result?.error) {
      setError('Account created, but login failed — try logging in.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Sign up</h1>
        {error && <p className="auth-error">{error}</p>}
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label>
          Password
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <p className="hint">At least 8 characters.</p>
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="hint">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
        <p className="hint">
          <Link href="/">Continue without an account</Link>
        </p>
      </form>
    </div>
  );
}
