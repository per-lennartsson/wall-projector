import type { WallProjectState, WorkspaceMeta } from '../types';
import { normalizeState } from '../normalizeState';
import { makeDefaultState } from '../defaults';

export const STORAGE_KEY = 'wallProjectorState.v1';
export const WORKSPACES_KEY = 'wallProjectorWorkspaces.v1';

export function workspaceStateKey(id: string): string {
  return `${STORAGE_KEY}.${id}`;
}

export function saveWorkspaceState(id: string, state: WallProjectState): void {
  try {
    localStorage.setItem(workspaceStateKey(id), JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state', e);
  }
}

export function readWorkspaceState(id: string): WallProjectState | null {
  try {
    const raw = localStorage.getItem(workspaceStateKey(id));
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not load workspace state', e);
    return null;
  }
}

export function removeWorkspaceState(id: string): void {
  try {
    localStorage.removeItem(workspaceStateKey(id));
  } catch (e) {
    console.warn('Could not remove workspace storage', e);
  }
}

export function saveWorkspaceIndex(workspaces: WorkspaceMeta[], activeId: string | null): void {
  try {
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify({ workspaces, activeId }));
  } catch (e) {
    console.warn('Could not save workspace index', e);
  }
}

export interface WorkspaceIndex {
  workspaces: WorkspaceMeta[];
  activeWorkspaceId: string;
}

/**
 * Populates workspaces/activeWorkspaceId from the index key. On first ever
 * run (no index yet), migrates a pre-workspaces single-project save (the old
 * bare STORAGE_KEY) into one "Wall" workspace, or seeds a fresh default
 * workspace if there was nothing saved at all. 1:1 port of app.js's
 * loadWorkspaces().
 */
export function loadWorkspaceIndex(): WorkspaceIndex {
  try {
    const raw = localStorage.getItem(WORKSPACES_KEY);
    if (raw) {
      const idx = JSON.parse(raw);
      if (idx && Array.isArray(idx.workspaces) && idx.workspaces.length) {
        const workspaces: WorkspaceMeta[] = idx.workspaces;
        const activeWorkspaceId = workspaces.some((w) => w.id === idx.activeId) ? idx.activeId : workspaces[0].id;
        return { workspaces, activeWorkspaceId };
      }
    }
  } catch (e) {
    console.warn('Could not load workspace index', e);
  }

  const id = 'default';
  const workspaces: WorkspaceMeta[] = [{ id, name: 'Wall' }];
  const legacyRaw = localStorage.getItem(STORAGE_KEY);
  if (legacyRaw) {
    try {
      localStorage.setItem(workspaceStateKey(id), legacyRaw);
    } catch (e) {
      console.warn('Could not migrate legacy save', e);
    }
  }
  saveWorkspaceIndex(workspaces, id);
  return { workspaces, activeWorkspaceId: id };
}

// Loads the given workspace's project data (falling back to a fresh default
// project if nothing is saved for it yet).
export function activateWorkspaceState(id: string): WallProjectState {
  return readWorkspaceState(id) || makeDefaultState();
}

export function sanitizeFilenamePart(name: string): string {
  return (name || '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'wall';
}

// Returns baseName, or "baseName (2)", "baseName (3)", ... if it already
// collides with a current workspace.
export function dedupeWorkspaceName(baseName: string, workspaces: WorkspaceMeta[]): string {
  let name = baseName;
  let n = 2;
  while (workspaces.some((w) => w.name === name)) {
    name = `${baseName} (${n++})`;
  }
  return name;
}

export function newWorkspaceId(): string {
  return 'ws-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Whether this browser has any local workspaces at all — checked before
// calling loadWorkspaceIndex()/gatherLocalWorkspacesBundle(), since
// loadWorkspaceIndex() seeds a fresh empty "Wall" workspace as a side effect
// when none exists yet, which would fabricate a phantom workspace for a
// cloud-only user who has never touched local mode.
export function hasLocalWorkspaces(): boolean {
  return localStorage.getItem(WORKSPACES_KEY) !== null || localStorage.getItem(STORAGE_KEY) !== null;
}

// Gathers every local workspace into the same bundle shape
// exportAllWorkspaces() produces, for the "import from this browser" cloud
// flow — the wire format is identical to a file-based export/import.
export function gatherLocalWorkspacesBundle(): { type: 'wall-projector-workspaces'; workspaces: { name: string; state: WallProjectState }[] } {
  const { workspaces } = loadWorkspaceIndex();
  return {
    type: 'wall-projector-workspaces',
    workspaces: workspaces.map((ws) => ({ name: ws.name, state: readWorkspaceState(ws.id) || makeDefaultState() })),
  };
}

// Wipes every local workspace + the UI-prefs key, used only after the user
// has confirmed a local->cloud import succeeded (never automatic).
export function clearAllLocalWorkspaces(): void {
  const { workspaces } = loadWorkspaceIndex();
  workspaces.forEach((ws) => removeWorkspaceState(ws.id));
  localStorage.removeItem(WORKSPACES_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

export function downloadJSON(obj: unknown, filename: string): void {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
