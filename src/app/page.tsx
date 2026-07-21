'use client';

import { useSession, signOut } from 'next-auth/react';

// Phase 1 checkpoint placeholder — replaced in Phase 3 with the real
// local-mode-vs-project-picker branching (see the Next.js rebuild plan).
export default function HomePage() {
  const { data: session, status } = useSession();

  if (status === 'loading') return null;

  return (
    <main>
      <h1>Wall Projector</h1>
      <p>Next.js + Prisma + NextAuth scaffold (Phase 1 checkpoint) — editor UI lands in Phase 3.</p>
      {session ? (
        <p>
          Logged in as {session.user?.email}. <button onClick={() => signOut()}>Log out</button>
        </p>
      ) : (
        <p>
          <a href="/login">Log in</a> or <a href="/signup">sign up</a>.
        </p>
      )}
    </main>
  );
}
