import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { getOwnedProject, projectToState } from '@/lib/project/mapper';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const project = await getOwnedProject(id, user.id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  return NextResponse.json(projectToState(project));
}
