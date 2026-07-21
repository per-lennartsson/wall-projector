'use client';

import React from 'react';

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Set the wall size',
    body: "Enter the real width and height of the wall (or screen) at the top, in whatever unit you like, then hit Apply. Everything else on this page — image sizes, frame widths, the calibration ruler, the grid — is measured in that same real-world unit from then on.",
  },
  {
    title: 'Add images',
    body: 'Upload file(s) or paste an image URL in the sidebar. New images default to the width set in Settings → New image defaults (30cm out of the box).',
  },
  {
    title: 'Position them',
    body: 'Drag an image to move it. Drag its corner handle to resize (aspect ratio stays locked — hold Shift to stretch freely). Drag the top handle to rotate. For exact placement, select an image and type X/Y/Width/Height directly in the sidebar. Delete key removes the selected image.',
  },
  {
    title: 'Optional: add a frame',
    body: "Turn on Frame for the selected image and pick a color (light/dark wood, black, white) and width. The frame adds onto the photo's size rather than shrinking it — Width/Height in the sidebar always describe the photo itself.",
  },
  {
    title: 'Calibrate the projector',
    body: "Turn on the Calibration ruler (Settings → gear icon) and project. Hold a tape measure to the lines at the top and bottom of the wall — if they don't measure the same real length, the projector has keystone distortion; adjust its position or keystone correction until both match.",
  },
  {
    title: 'Optional: mark nail positions',
    body: 'Turn on hanging-point dots (Settings) to mark where each nail should go. Drag a dot to position it, or use "+ Add nail" for images that need more than one. Positions are in cm from the photo\'s own top-left corner, so they stay accurate if you resize the wall.',
  },
  {
    title: 'Project',
    body: 'Click Project (top right) to go fullscreen on your projector/second display — the sidebar and toolbar hide, and the wall fills the whole screen at the same position it was in the editor, so nothing jumps. Press Escape or click Exit to come back.',
  },
  {
    title: 'Save your work',
    body: "Everything auto-saves to this browser. Use the tabs at the top to keep multiple walls/workspaces side by side — click + for a new one, click a tab's name to rename it. To back up or move workspaces to another computer, use Settings → Project file → Export this workspace (just the current tab) or Export all workspaces (every tab, one file) — Import loads either kind of file back in as new tab(s).",
  },
];

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      id="help-modal"
      className="modal-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <h2>How to use</h2>
          <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {STEPS.map((step, i) => (
            <div className="help-step" key={i}>
              <div className="step-num">{i + 1}</div>
              <div>
                <h2>{step.title}</h2>
                <p className="hint">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
