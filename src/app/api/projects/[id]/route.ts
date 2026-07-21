import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/requireUser';
import { getOwnedProject, imagesCreateInput, projectScalarUpdateData, projectToState } from '@/lib/project/mapper';
import { wallProjectStateSchema } from '@/lib/project/state';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  return NextResponse.json(projectToState(project));
}

export async function PUT(request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedProject(id, user.id);
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = wallProjectStateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid project state', details: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.project.update({
    where: { id },
    data: {
      ...projectScalarUpdateData(parsed.data),
      images: {
        deleteMany: {},
        create: imagesCreateInput(parsed.data.images),
      },
    },
  });

  const updated = await getOwnedProject(id, user.id);
  return NextResponse.json(projectToState(updated!));
}

const renameSchema = z.object({ name: z.string() });

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedProject(id, user.id);
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const project = await prisma.project.update({ where: { id }, data: { name: parsed.data.name } });
  return NextResponse.json({ id: project.id, name: project.name, updated_at: project.updatedAt });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const existing = await getOwnedProject(id, user.id);
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
