import { headers } from 'next/headers';
import { auth } from './auth';
import { prisma } from './prisma';

// Re-checks the user still exists on every call (rather than trusting the
// session alone), matching the pre-rebuild get_current_user dependency's
// behavior of rejecting a session for a since-deleted account.
export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}
