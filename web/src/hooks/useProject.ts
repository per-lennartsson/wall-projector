import { useCallback, useRef, useState } from 'react';
import type { WallProjectState, WorkspaceMeta } from '../types';
import { makeDefaultState } from '../defaults';
import { normalizeState } from '../normalizeState';
import {
  activateWorkspaceState,
  dedupeWorkspaceName,
  downloadJSON,
  loadWorkspaceIndex,
  newWorkspaceId,
  readWorkspaceState,
  removeWorkspaceState,
  saveWorkspaceIndex,
  saveWorkspaceState,
  sanitizeFilenamePart,
} from '../storage/workspaces';
import { useProjectCore } from './useProjectCore';

/**
 * Local (no-login) mode: multi-workspace editing backed by localStorage.
 * Thin wrapper over useProjectCore() — only the workspace list and the
 * localStorage read/write calls are specific to this mode; all state
 * mutation/undo-redo/interaction logic lives in useProjectCore and is shared
 * with useCloudProject() (logged-in mode).
 */
export function useProject() {
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  activeWorkspaceIdRef.current = activeWorkspaceId;

  const core = useProjectCore({
    bootstrap: () => {
      const { workspaces: ws, activeWorkspaceId: activeId } = loadWorkspaceIndex();
      setWorkspaces(ws);
      setActiveWorkspaceId(activeId);
      activeWorkspaceIdRef.current = activeId;
      return activateWorkspaceState(activeId);
    },
    onPersist: (state) => saveWorkspaceState(activeWorkspaceIdRef.current, state),
  });

  // ---------- workspaces ----------
  const switchWorkspace = useCallback(
    (id: string) => {
      if (id === activeWorkspaceIdRef.current) return;
      core.flushSave();
      const next = activateWorkspaceState(id);
      setActiveWorkspaceId(id);
      activeWorkspaceIdRef.current = id;
      core.loadState(next);
      saveWorkspaceIndex(workspacesRef.current, id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const createWorkspace = useCallback(() => {
    core.flushSave();
    const id = newWorkspaceId();
    const fresh = makeDefaultState();
    saveWorkspaceState(id, fresh);
    const newWs = [...workspacesRef.current, { id, name: `Workspace ${workspacesRef.current.length + 1}` }];
    setWorkspaces(newWs);
    setActiveWorkspaceId(id);
    activeWorkspaceIdRef.current = id;
    core.loadState(fresh);
    saveWorkspaceIndex(newWs, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteWorkspace = useCallback((id: string) => {
    const current = workspacesRef.current;
    if (current.length <= 1) return;
    if (!window.confirm('Delete this workspace? This cannot be undone.')) return;
    const idx = current.findIndex((w) => w.id === id);
    if (idx === -1) return;
    const newWs = current.filter((w) => w.id !== id);
    removeWorkspaceState(id);
    let nextActiveId = activeWorkspaceIdRef.current;
    if (activeWorkspaceIdRef.current === id) {
      nextActiveId = newWs[Math.max(0, idx - 1)].id;
      const next = activateWorkspaceState(nextActiveId);
      setActiveWorkspaceId(nextActiveId);
      activeWorkspaceIdRef.current = nextActiveId;
      core.loadState(next);
    }
    setWorkspaces(newWs);
    saveWorkspaceIndex(newWs, nextActiveId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renameWorkspace = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newWs = workspacesRef.current.map((w) => (w.id === id ? { ...w, name: trimmed } : w));
    setWorkspaces(newWs);
    saveWorkspaceIndex(newWs, activeWorkspaceIdRef.current);
  }, []);

  // ---------- export / import ----------
  const exportCurrentWorkspace = useCallback(() => {
    const ws = workspacesRef.current.find((w) => w.id === activeWorkspaceIdRef.current);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJSON(core.state, `wall-projector-${sanitizeFilenamePart(ws?.name ?? '')}-${stamp}.json`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.state]);

  const exportAllWorkspaces = useCallback(() => {
    core.flushSave();
    const bundle = {
      type: 'wall-projector-workspaces' as const,
      workspaces: workspacesRef.current.map((ws) => ({
        name: ws.name,
        state: readWorkspaceState(ws.id) || makeDefaultState(),
      })),
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJSON(bundle, `wall-projector-all-${stamp}.json`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addImportedWorkspace(name: string, wsState: WallProjectState): string {
    const dedupedName = dedupeWorkspaceName(name, workspacesRef.current);
    const id = newWorkspaceId();
    saveWorkspaceState(id, wsState);
    workspacesRef.current = [...workspacesRef.current, { id, name: dedupedName }];
    return id;
  }

  function activateImportedWorkspace(id: string) {
    core.flushSave();
    const next = activateWorkspaceState(id);
    setActiveWorkspaceId(id);
    activeWorkspaceIdRef.current = id;
    core.loadState(next);
    setWorkspaces(workspacesRef.current);
    saveWorkspaceIndex(workspacesRef.current, id);
  }

  const importProjectFromFile = useCallback((file: File, onDone?: () => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: any;
      try {
        parsed = JSON.parse(reader.result as string);
      } catch {
        window.alert("That doesn't look like a Wall Projector project file.");
        return;
      }

      if (parsed && parsed.type === 'wall-projector-workspaces' && Array.isArray(parsed.workspaces)) {
        if (!parsed.workspaces.length) {
          window.alert('That file has no workspaces in it.');
          return;
        }
        let normalized: { name: string; state: WallProjectState }[];
        try {
          normalized = parsed.workspaces.map((entry: any) => ({
            name: entry.name || 'Imported',
            state: normalizeState(entry.state),
          }));
        } catch {
          window.alert("That doesn't look like a Wall Projector workspaces file.");
          return;
        }
        let firstId: string | null = null;
        normalized.forEach(({ name, state: wsState }) => {
          const id = addImportedWorkspace(name, wsState);
          if (firstId === null) firstId = id;
        });
        activateImportedWorkspace(firstId!);
        onDone?.();
        return;
      }

      let next: WallProjectState;
      try {
        next = normalizeState(parsed);
      } catch {
        window.alert("That doesn't look like a Wall Projector project file.");
        return;
      }
      const id = addImportedWorkspace(file.name.replace(/\.json$/i, '') || 'Imported', next);
      activateImportedWorkspace(id);
      onDone?.();
    };
    reader.onerror = () => window.alert('Could not read that file.');
    reader.readAsText(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...core,
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    exportCurrentWorkspace,
    exportAllWorkspaces,
    importProjectFromFile,
  };
}

export type UseProjectReturn = ReturnType<typeof useProject>;
