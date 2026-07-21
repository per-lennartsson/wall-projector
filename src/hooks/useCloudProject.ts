import { useCallback, useEffect, useRef, useState } from 'react';
import * as cloudApi from '../data/cloudApi';
import { downloadJSON, sanitizeFilenamePart } from '../storage/workspaces';
import { useProjectCore } from './useProjectCore';

/**
 * Cloud (logged-in) mode: edits a single API-backed project. Thin wrapper
 * over useProjectCore(), mirroring useProject()'s relationship to it —
 * only the load/save calls differ (API instead of localStorage), and there's
 * no workspace-tabs concept (the project picker page fills that role).
 */
export function useCloudProject(projectId: string) {
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const [projectName, setProjectName] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const core = useProjectCore({
    bootstrap: () => cloudApi.getProject(projectIdRef.current),
    onPersist: (state) => {
      cloudApi.putProject(projectIdRef.current, state).catch((err) => {
        console.warn('Could not save project to server', err);
      });
    },
  });

  useEffect(() => {
    cloudApi
      .listProjects()
      .then((list) => {
        const summary = list.find((p) => p.id === projectId);
        if (summary) setProjectName(summary.name);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load project'));
  }, [projectId]);

  const bootErrorMessage =
    core.bootError instanceof Error ? core.bootError.message : core.bootError ? 'Failed to load project' : null;

  const renameProject = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await cloudApi.renameProject(projectIdRef.current, trimmed);
    setProjectName(trimmed);
  }, []);

  const exportProject = useCallback(async () => {
    const state = await cloudApi.exportProject(projectIdRef.current);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJSON(state, `wall-projector-${sanitizeFilenamePart(projectName)}-${stamp}.json`);
  }, [projectName]);

  return { ...core, projectId, projectName, renameProject, exportProject, loadError: loadError ?? bootErrorMessage };
}

export type UseCloudProjectReturn = ReturnType<typeof useCloudProject>;
