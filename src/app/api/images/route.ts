import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/requireUser';

// Own path (not nested under /api/projects) so there's no route-ordering
// ambiguity with GET /api/projects/[id].
//
// No object storage/thumbnailing pipeline exists (images are base64 `src`
// in the DB — see CLAUDE.md), so this endpoint returns full-resolution
// images same as everywhere else in the app. SCAN_LIMIT/RESULT_LIMIT bound
// both the DB work and the response size in lieu of real pagination or
// thumbnails.
const SCAN_LIMIT = 1000;
const RESULT_LIMIT = 48;

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const images = await prisma.projectImage.findMany({
    where: { project: { userId: user.id } },
    orderBy: { updatedAt: 'desc' },
    take: SCAN_LIMIT,
  });

  // Dedupe by content hash, keeping the most recent occurrence (rows are
  // already ordered newest-first, so "first seen" == "most recent").
  const seen = new Map<string, (typeof images)[number]>();
  for (const im of images) {
    if (seen.has(im.contentHash)) continue;
    seen.set(im.contentHash, im);
    if (seen.size >= RESULT_LIMIT) break;
  }

  return NextResponse.json(
    Array.from(seen.values()).map((im) => ({
      id: im.contentHash,
      src: im.src,
      name: im.name,
      naturalW: im.naturalW,
      naturalH: im.naturalH,
    })),
  );
}
