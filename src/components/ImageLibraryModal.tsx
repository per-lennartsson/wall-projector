'use client';

import React, { useEffect, useState } from 'react';
import type { LibraryImage } from '../types';

interface ImageLibraryModalProps {
  open: boolean;
  onClose: () => void;
  loadLibrary: () => LibraryImage[] | Promise<LibraryImage[]>;
  onPick: (img: LibraryImage) => void;
}

/**
 * "Choose from my images" picker — reuses a photo already added to any of
 * the user's projects/workspaces instead of re-uploading it. loadLibrary is
 * sync in local mode (localStorage scan) and async in cloud mode (API
 * fetch); both are supported via Promise.resolve().
 */
export function ImageLibraryModal({ open, onClose, loadLibrary, onPick }: ImageLibraryModalProps) {
  const [images, setImages] = useState<LibraryImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setImages(null);
    setError(null);
    Promise.resolve(loadLibrary()).then(
      (result) => {
        if (!cancelled) setImages(result);
      },
      () => {
        if (!cancelled) setError("Couldn't load your images.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, loadLibrary]);

  if (!open) return null;

  return (
    <div
      id="image-library-modal"
      className="modal-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <h2>Choose from my images</h2>
          <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {error && <p className="hint">{error}</p>}
          {!error && images === null && <p className="hint">Loading…</p>}
          {!error && images !== null && images.length === 0 && (
            <p className="hint">No images yet — upload one first.</p>
          )}
          {!error && images !== null && images.length > 0 && (
            <div className="library-grid">
              {images.map((img) => (
                <button key={img.id} type="button" className="library-thumb" title={img.name} onClick={() => onPick(img)}>
                  <img src={img.src} alt="" loading="lazy" />
                  <span className="library-thumb-name">{img.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
