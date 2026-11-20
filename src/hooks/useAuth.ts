import { authClient } from '@/lib/auth-client';

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Thin wrapper over Better Auth's useSession(), keeping the small surface
 * (user/ready/logout) that ProjectPickerPage and the root page already use.
 * Sign-in goes through authClient.signIn.social() from the login page.
 */
export function useAuth() {
  const { data: session, isPending } = authClient.useSession();
  const user: AuthUser | null = session?.user ? { id: session.user.id, email: session.user.email } : null;
  return {
    user,
    ready: !isPending,
    logout: () => authClient.signOut(),
  };
}
