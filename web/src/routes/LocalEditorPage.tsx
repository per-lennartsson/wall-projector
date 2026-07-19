import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { EditorShell } from '../components/EditorShell';
import { WorkspaceTabs } from '../components/WorkspaceTabs';

export default function LocalEditorPage() {
  const project = useProject();
  const importInputRef = useRef<HTMLInputElement>(null);

  const fileSection = (
    <>
      <div className="button-row">
        <button type="button" onClick={project.exportCurrentWorkspace}>
          Export this workspace…
        </button>
        <button type="button" onClick={project.exportAllWorkspaces}>
          Export all workspaces…
        </button>
      </div>
      <div className="button-row">
        <button type="button" onClick={() => importInputRef.current?.click()}>
          Import…
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) project.importProjectFromFile(file);
            e.target.value = '';
          }}
        />
      </div>
      <p className="hint">
        Export this workspace saves just the current tab; export all workspaces bundles every tab into one file. Either way it's a backup/share
        file, named after the workspace(s). Import loads a file back in as new workspace tab(s) — a single-workspace file adds one tab, a bundle
        adds one per workspace inside it — it never overwrites the tab you're currently on.
      </p>
    </>
  );

  return (
    <EditorShell
      project={project}
      middleArea={<WorkspaceTabs project={project} />}
      fileSection={fileSection}
      authArea={
        <Link to="/login" className="icon-btn" title="Sign in to sync your projects to the cloud" aria-label="Log in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      }
    />
  );
}
