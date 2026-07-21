'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCloudProject } from '@/hooks/useCloudProject';
import { EditorShell } from '@/components/EditorShell';
import { listImageLibrary } from '@/data/cloudApi';

export default function CloudEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const project = useCloudProject(id);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  if (project.loadError) {
    return (
      <div className="project-picker-page">
        <p className="hint">Couldn&apos;t load this project: {project.loadError}</p>
        <Link href="/">‹ Back to projects</Link>
      </div>
    );
  }

  if (!project.ready) {
    return (
      <div className="project-picker-page">
        <p className="hint">Loading…</p>
      </div>
    );
  }

  const middleArea = (
    <div className="tab-strip">
      <Link href="/" className="icon-btn" title="Back to projects" aria-label="Back to projects">
        ‹
      </Link>
      <div className="tab active">
        {renaming ? (
          <input
            className="tab-name-edit"
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              project.renameProject(draftName);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <span
            className="tab-name"
            onDoubleClick={() => {
              setDraftName(project.projectName);
              setRenaming(true);
            }}
          >
            {project.projectName}
          </span>
        )}
      </div>
    </div>
  );

  const fileSection = (
    <>
      <div className="button-row">
        <button type="button" onClick={project.exportProject}>
          Export this project…
        </button>
      </div>
      <p className="hint">Downloads a backup/share file for this project, in the same format as local-mode export.</p>
    </>
  );

  return <EditorShell project={project} middleArea={middleArea} fileSection={fileSection} imageLibrary={listImageLibrary} />;
}
