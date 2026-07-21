import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from './prisma';

// Re-checks the user still exists on every call (rather than trusting the
// session JWT's claims alone), matching the pre-rebuild get_current_user
// dependency's behavior of rejecting a session for a since-deleted account.
export async function requireUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}
