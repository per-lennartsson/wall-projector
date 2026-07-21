'use client';

import React, { useRef, useState } from 'react';
import type { ProjectCore } from '../hooks/useProjectCore';
import type { LibraryImage } from '../types';
import { LayersList } from './LayersList';
import { PropsPanel } from './PropsPanel';
import { ImageLibraryModal } from './ImageLibraryModal';

interface SidebarProps {
  project: ProjectCore;
  sidebarCollapsed: boolean;
  layersCompact: boolean;
  onToggleCollapsed: () => void;
  onToggleLayersCompact: () => void;
  getCanvasRect: () => { width: number; height: number };
  topOffsetPx: number;
  imageLibrary: () => LibraryImage[] | Promise<LibraryImage[]>;
}

export function Sidebar({
  project,
  sidebarCollapsed,
  layersCompact,
  onToggleCollapsed,
  onToggleLayersCompact,
  getCanvasRect,
  topOffsetPx,
  imageLibrary,
}: SidebarProps) {
  const [urlValue, setUrlValue] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    Array.from(files || []).forEach((file) => project.addImageFromFile(file, getCanvasRect()));
  }

  function handleAddUrl() {
    const url = urlValue.trim();
    if (url) {
      project.addImageFromUrl(url, getCanvasRect());
      setUrlValue('');
    }
  }

  return (
    <aside id="sidebar" style={{ top: topOffsetPx + 'px' }}>
      <button
        id="sidebar-collapse-btn"
        className={'icon-btn' + (sidebarCollapsed ? ' collapsed' : '')}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => onToggleCollapsed()}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <section>
        <h2>Add image</h2>
        <label className="file-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
            <path d="M21 15l-5.5-5-9.5 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span>Upload image(s)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>

        <div className="url-row">
          <input
            type="text"
            placeholder="Paste image URL…"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddUrl();
            }}
          />
          <button onClick={handleAddUrl}>Add</button>
        </div>

        <button type="button" className="library-open-btn" onClick={() => setLibraryOpen(true)}>
          Choose from my images…
        </button>
      </section>

      <section id="layers-section">
        <div className="section-header">
          <h2>Layers</h2>
          <button
            className="icon-btn"
            title="Toggle compact rows"
            aria-label="Toggle compact rows"
            onClick={() => onToggleLayersCompact()}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <LayersList project={project} />
      </section>

      <section>
        <h2>Selected image</h2>
        <PropsPanel project={project} />
      </section>

      <section>
        <button className="danger-outline" onClick={project.clearAll}>
          Clear all
        </button>
      </section>

      <ImageLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        loadLibrary={imageLibrary}
        onPick={(img) => project.addImage(img.src, img.naturalW, img.naturalH, img.name, getCanvasRect())}
      />
    </aside>
  );
}
