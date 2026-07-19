import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCloudProject } from '../hooks/useCloudProject';
import { EditorShell } from '../components/EditorShell';

export default function CloudEditorPage() {
  const { id } = useParams<{ id: string }>();
  const project = useCloudProject(id!);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');

  if (project.loadError) {
    return (
      <div className="project-picker-page">
        <p className="hint">Couldn't load this project: {project.loadError}</p>
        <Link to="/">‹ Back to projects</Link>
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
      <Link to="/" className="icon-btn" title="Back to projects" aria-label="Back to projects">
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

  return <EditorShell project={project} middleArea={middleArea} fileSection={fileSection} />;
}
