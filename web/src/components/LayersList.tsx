import React from 'react';
import type { ProjectCore } from '../hooks/useProjectCore';

export function LayersList({ project }: { project: ProjectCore }) {
  const { state, selectedIds, selectImage, bringToFront, removeImage } = project;
  const images = state.images;

  return (
    <>
      <ul id="layers-list">
        {/* topmost layer shown first */}
        {[...images].reverse().map((im) => (
          <li
            key={im.id}
            className={'layer-item' + (selectedIds.has(im.id) ? ' selected' : '')}
            data-id={im.id}
            onClick={(e) => selectImage(im.id, { additive: e.shiftKey || e.ctrlKey || e.metaKey })}
          >
            <img src={im.src} alt="" />
            <span className="layer-name">{im.name}</span>
            <button
              title="Bring to front"
              onClick={(e) => {
                e.stopPropagation();
                bringToFront(im.id);
              }}
            >
              ⤒
            </button>
            <button
              className="delete-btn"
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                removeImage(im.id);
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {images.length === 0 && (
        <p id="layers-empty" className="hint">
          No images yet — upload or paste a link.
        </p>
      )}
    </>
  );
}
