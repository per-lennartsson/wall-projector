'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    // On success the browser is redirected to Authentik, so there is nothing
    // to do afterwards; only a failure to start the flow comes back here.
    const { error: signInError } = await authClient.signIn.social({ provider: 'authentik', callbackURL: '/' });
    if (signInError) {
      setError(signInError.message || 'Could not start sign-in');
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Log in</h1>
        {error && <p className="auth-error">{error}</p>}
        <button type="button" className="primary" onClick={handleSignIn} disabled={busy}>
          {busy ? 'Redirecting…' : 'Sign in with Authentik'}
        </button>
        <p className="hint">
          You sign in with an emailed code or a passkey. New here? You can create an account on the sign-in page.
        </p>
        <p className="hint">
          <Link href="/">Continue without an account</Link>
        </p>
      </div>
    </div>
  );
}
