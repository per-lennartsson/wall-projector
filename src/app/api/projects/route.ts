import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/requireUser';

// Without a cap, a single free account could create unlimited projects (each
// carrying up to 200 images at ~11MB apiece — see src/lib/project/state.ts)
// and exhaust the database. Generous enough for any real usage.
const MAX_PROJECTS_PER_USER = 100;

const createSchema = z.object({ name: z.string() });

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, updatedAt: true },
  });
  return NextResponse.json(projects.map((p) => ({ id: p.id, name: p.name, updated_at: p.updatedAt })));
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const count = await prisma.project.count({ where: { userId: user.id } });
  if (count + 1 > MAX_PROJECTS_PER_USER) {
    return NextResponse.json(
      { error: `Project limit reached (max ${MAX_PROJECTS_PER_USER} per account)` },
      { status: 400 },
    );
  }

  const project = await prisma.project.create({ data: { userId: user.id, name: parsed.data.name } });
  return NextResponse.json({ id: project.id, name: project.name, updated_at: project.updatedAt }, { status: 201 });
}
