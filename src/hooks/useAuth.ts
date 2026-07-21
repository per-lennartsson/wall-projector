import { useSession, signOut } from 'next-auth/react';

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Thin wrapper over NextAuth's useSession(), matching the small surface the
 * pre-rebuild AuthContext exposed (user/ready/logout) so ProjectPickerPage
 * and the root page didn't need bigger changes. Login/signup go straight
 * through next-auth/react's signIn() from their own pages instead of a
 * shared context method — NextAuth already owns that flow end to end.
 */
export function useAuth() {
  const { data: session, status } = useSession();
  const user: AuthUser | null = session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null;
  return {
    user,
    ready: status !== 'loading',
    logout: () => signOut({ redirect: false }),
  };
}
