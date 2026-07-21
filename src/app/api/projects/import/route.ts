import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/requireUser';
import { normalizeState } from '@/lib/project/normalize';
import { imagesCreateInput, projectScalarUpdateData } from '@/lib/project/mapper';
import { wallProjectStateSchema, type WallProjectState } from '@/lib/project/state';

const MAX_PROJECTS_PER_USER = 100;
// Caps how many projects one import call can create, both to keep this
// bounded work and so it composes with the per-user project quota below.
const MAX_IMPORT_ENTRIES = 50;

interface ImportEntry {
  name: string;
  rawState: unknown;
}

// Mirrors the frontend's importProjectFromFile(): accepts either a single
// ProjectState, or a {type:'wall-projector-workspaces', workspaces:[...]}
// bundle (one project created per entry). Every field pulled off the raw
// body is validated before use — a crafted bundle (e.g. a workspace entry
// that isn't an object, or is missing "state") gets a clean 400 instead of
// an unhandled crash.
function parseEntries(body: unknown): ImportEntry[] | null {
  if (body && typeof body === 'object' && (body as any).type === 'wall-projector-workspaces') {
    const workspaces = (body as any).workspaces;
    if (!Array.isArray(workspaces) || workspaces.length === 0) return null;
    const entries: ImportEntry[] = [];
    for (const w of workspaces) {
      if (!w || typeof w !== 'object' || !w.state || typeof w.state !== 'object') return null;
      entries.push({ name: typeof w.name === 'string' && w.name ? w.name : 'Imported', rawState: w.state });
    }
    return entries;
  }
  return [{ name: 'Imported', rawState: body }];
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const entries = parseEntries(body);
  if (!entries) {
    return NextResponse.json({ error: 'No workspaces in bundle' }, { status: 400 });
  }
  if (entries.length > MAX_IMPORT_ENTRIES) {
    return NextResponse.json(
      { error: `Too many workspaces in one import (max ${MAX_IMPORT_ENTRIES})` },
      { status: 400 },
    );
  }

  const count = await prisma.project.count({ where: { userId: user.id } });
  if (count + entries.length > MAX_PROJECTS_PER_USER) {
    return NextResponse.json(
      { error: `Project limit reached (max ${MAX_PROJECTS_PER_USER} per account)` },
      { status: 400 },
    );
  }

  // Validate every entry up front so the import is all-or-nothing — mirrors
  // the pre-rebuild endpoint's single commit-at-the-end behavior, rather
  // than partially importing a bundle when a later entry turns out invalid.
  const parsedEntries: { name: string; state: WallProjectState }[] = [];
  for (const entry of entries) {
    let normalized: unknown;
    try {
      normalized = normalizeState(entry.rawState);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid project state' }, { status: 400 });
    }
    const parsed = wallProjectStateSchema.safeParse(normalized);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid project state', details: parsed.error.flatten() }, { status: 400 });
    }
    parsedEntries.push({ name: entry.name, state: parsed.data });
  }

  const projectIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const { name, state } of parsedEntries) {
      const project = await tx.project.create({
        data: {
          userId: user.id,
          name,
          ...projectScalarUpdateData(state),
          images: { create: imagesCreateInput(state.images) },
        },
      });
      ids.push(project.id);
    }
    return ids;
  });

  return NextResponse.json({ project_ids: projectIds });
}
