'use client';

import React, { useState } from 'react';
import type { UseProjectReturn } from '../hooks/useProject';

export function WorkspaceTabs({ project }: { project: UseProjectReturn }) {
  const { workspaces, activeWorkspaceId, switchWorkspace, createWorkspace, deleteWorkspace, renameWorkspace } = project;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setDraftName(currentName);
  }
  function commitRename(id: string) {
    if (draftName.trim()) renameWorkspace(id, draftName);
    setRenamingId(null);
  }

  return (
    <div id="workspace-tabs" className="tab-strip">
      {workspaces.map((ws) => (
        <div
          key={ws.id}
          className={'tab' + (ws.id === activeWorkspaceId ? ' active' : '')}
          data-id={ws.id}
          onClick={() => {
            if (ws.id !== activeWorkspaceId) switchWorkspace(ws.id);
          }}
        >
          {renamingId === ws.id ? (
            <input
              className="tab-name-edit"
              autoFocus
              value={draftName}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => commitRename(ws.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(ws.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
            />
          ) : (
            <span
              className="tab-name"
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename(ws.id, ws.name);
              }}
            >
              {ws.name}
            </span>
          )}
          {workspaces.length > 1 && (
            <button
              className="tab-close"
              title="Delete workspace"
              onClick={(e) => {
                e.stopPropagation();
                deleteWorkspace(ws.id);
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button id="workspace-add-btn" className="icon-btn" title="New workspace" aria-label="New workspace" onClick={createWorkspace}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
