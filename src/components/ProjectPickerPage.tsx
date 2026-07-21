'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import * as cloudApi from '../data/cloudApi';
import type { ProjectSummary } from '../data/cloudApi';
import { clearAllLocalWorkspaces, gatherLocalWorkspacesBundle, hasLocalWorkspaces } from '../storage/workspaces';

export default function ProjectPickerPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    setLoading(true);
    cloudApi
      .listProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleCreate() {
    const name = window.prompt('Project name?', 'My Wall');
    if (!name) return;
    const created = await cloudApi.createProject(name);
    router.push(`/project/${created.id}`);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    await cloudApi.deleteProject(id);
    refresh();
  }

  async function handleImportFromLocal() {
    if (!hasLocalWorkspaces()) {
      window.alert("This browser doesn't have any local (no-login) projects to import.");
      return;
    }
    const bundle = gatherLocalWorkspacesBundle();
    const names = bundle.workspaces.map((w) => w.name).join(', ');
    if (!window.confirm(`Import ${bundle.workspaces.length} local workspace(s) into your account? (${names})`)) return;
    try {
      await cloudApi.importProjects(bundle);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Import failed.');
      return;
    }
    refresh();
    // Only clear local data after the import above has actually succeeded —
    // never automatically, so a partial failure can't lose data.
    if (window.confirm('Import succeeded. Clear the local (no-login) copies from this browser now?')) {
      clearAllLocalWorkspaces();
    }
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        await cloudApi.importProjects(parsed);
        refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "That doesn't look like a Wall Projector project file.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="project-picker-page">
      <div className="project-picker-header">
        <h1>Your projects</h1>
        <div className="button-row">
          <span className="hint">{user?.email}</span>
          <button type="button" onClick={() => logout().then(() => router.push('/'))}>
            Log out
          </button>
        </div>
      </div>

      <div className="project-picker-list">
        <div className="button-row">
          <button type="button" className="primary" onClick={handleCreate}>
            + New project
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}>
            Import…
          </button>
          <button type="button" onClick={handleImportFromLocal}>
            Import from this browser&apos;s local projects…
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {loading && <p className="hint">Loading…</p>}
        {error && <p className="hint">{error}</p>}
        {!loading && !projects.length && <p className="hint">No projects yet — create one to get started.</p>}

        {projects.map((p) => (
          <div key={p.id} className="project-picker-item" onClick={() => router.push(`/project/${p.id}`)}>
            <span>{p.name}</span>
            <button
              type="button"
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(p.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
