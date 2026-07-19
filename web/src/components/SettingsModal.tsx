import React, { useState } from 'react';
import type { ProjectCore } from '../hooks/useProjectCore';
import type { ThemeChoice } from '../storage/uiPrefs';

interface SettingsModalProps {
  project: ProjectCore;
  open: boolean;
  onClose: () => void;
  theme: ThemeChoice;
  onSetTheme: (t: ThemeChoice) => void;
  /** Local mode passes export/import buttons here; cloud mode passes its own
   * (single-project) export UI, or omits the section entirely if undefined. */
  fileSection?: React.ReactNode;
}

const BASE_SECTIONS = [
  { id: 'appearance-section', label: 'Appearance' },
  { id: 'defaults-section', label: 'New image defaults' },
  { id: 'calibration-section', label: 'Calibration ruler' },
  { id: 'keystone-section', label: 'Keystone correction' },
  { id: 'background-section', label: 'Wall background' },
  { id: 'grid-section', label: 'Reference grid' },
  { id: 'nail-section', label: 'Hanging point' },
];
const FILE_SECTION = { id: 'project-file-section', label: 'Project file' };

export function SettingsModal({ project, open, onClose, theme, onSetTheme, fileSection }: SettingsModalProps) {
  const [section, setSection] = useState('appearance-section');
  const { state, updateRuler, updateBackground, updateDefaults, updateGrid, updateNailGlobal, updateKeystone } = project;
  const SECTIONS = fileSection ? [...BASE_SECTIONS, FILE_SECTION] : BASE_SECTIONS;

  if (!open) return null;
  const unit = state.wall.unit;
  const activeSection = SECTIONS.some((s) => s.id === section) ? section : 'appearance-section';
  const activeLabel = SECTIONS.find((s) => s.id === activeSection)?.label ?? '';

  return (
    <div
      id="settings-modal"
      className="modal-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel">
        <nav className="settings-nav">
          <div className="settings-nav-title">Settings</div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={'settings-nav-item' + (activeSection === s.id ? ' active' : '')}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <div className="modal-header">
            <h2>{activeLabel}</h2>
            <button className="icon-btn" title="Close" aria-label="Close" onClick={onClose}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <section id="appearance-section" className={activeSection === 'appearance-section' ? 'active-section' : ''}>
              <div className="prop-row">
                <label>Theme</label>
                <div id="theme-picker" className="segmented">
                  {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
                    <button key={t} type="button" className={theme === t ? 'active' : ''} onClick={() => onSetTheme(t)}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="hint">"System" follows your OS/browser's light or dark setting automatically.</p>
            </section>

            {fileSection && (
              <section id="project-file-section" className={activeSection === 'project-file-section' ? 'active-section' : ''}>
                {fileSection}
              </section>
            )}

            <section id="defaults-section" className={activeSection === 'defaults-section' ? 'active-section' : ''}>
              <div className="prop-row">
                <label>Width ({unit})</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={state.defaults.imageWidth}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v > 0) updateDefaults({ imageWidth: v });
                  }}
                />
              </div>
              <div className="prop-row">
                <label>Add frame</label>
                <input type="checkbox" checked={state.defaults.frameEnabled} onChange={(e) => updateDefaults({ frameEnabled: e.target.checked })} />
              </div>
              <div className="prop-row">
                <label>Frame color</label>
                <select value={state.defaults.frameColor} onChange={(e) => updateDefaults({ frameColor: e.target.value as any })}>
                  <option value="light-wood">Light wood</option>
                  <option value="dark-wood">Dark wood</option>
                  <option value="black">Black</option>
                  <option value="white">White</option>
                </select>
              </div>
              <div className="prop-row">
                <label>Frame width ({unit})</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={state.defaults.frameWidth}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v >= 0) updateDefaults({ frameWidth: v });
                  }}
                />
              </div>
              <p className="hint">Applies to images you add from now on — existing images are unaffected.</p>
            </section>

            <section id="calibration-section" className={activeSection === 'calibration-section' ? 'active-section' : ''}>
              <div className="prop-row">
                <label>Length ({unit})</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={state.ruler.length}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v > 0) updateRuler({ length: v });
                  }}
                />
              </div>
              <div className="prop-row">
                <label>Color</label>
                <input type="color" value={state.ruler.color} onChange={(e) => updateRuler({ color: e.target.value })} />
              </div>
              <div className="prop-row">
                <label>Show on wall</label>
                <input type="checkbox" checked={state.ruler.visible} onChange={(e) => updateRuler({ visible: e.target.checked })} />
              </div>
              <p className="hint">
                Shown at both the top and bottom of the wall. Project, then hold a tape measure to each line. If they don't measure the same, the
                projector has keystone distortion — adjust its position/lens-shift/keystone correction until both match.
              </p>
            </section>

            <section id="keystone-section" className={activeSection === 'keystone-section' ? 'active-section' : ''}>
              <div className="prop-row">
                <label>Enable</label>
                <input type="checkbox" checked={state.keystone.enabled} onChange={(e) => updateKeystone({ enabled: e.target.checked })} />
              </div>
              <div className="prop-row">
                <label>Vertical (top/bottom)</label>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={state.keystone.vertical}
                  onChange={(e) => updateKeystone({ vertical: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="prop-row">
                <label>Horizontal (left/right)</label>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={state.keystone.horizontal}
                  onChange={(e) => updateKeystone({ horizontal: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <p className="hint">
                Pre-warps the whole wall (images, grid, ruler) to compensate for a projector that isn't perfectly perpendicular to the wall. Adjust
                while projecting until the wall looks rectangular again. Off by default — the calibration ruler above is still the best way to
                check.
              </p>
            </section>

            <section id="background-section" className={activeSection === 'background-section' ? 'active-section' : ''}>
              <div className="prop-row">
                <label>Show color</label>
                <input type="checkbox" checked={state.background.enabled} onChange={(e) => updateBackground({ enabled: e.target.checked })} />
              </div>
              <div className="prop-row">
                <label>Color</label>
                <input type="color" value={state.background.color} onChange={(e) => updateBackground({ color: e.target.value })} />
              </div>
              <div className="prop-row">
                <label>Also show when projecting</label>
                <input
                  type="checkbox"
                  checked={state.background.projectToo}
                  onChange={(e) => updateBackground({ projectToo: e.target.checked })}
                />
              </div>
              <p className="hint">
                Off by default: projected/fullscreen output stays black outside your images. Turn this on to project the color too (e.g. to tint
                the wall).
              </p>
            </section>

            <section id="grid-section" className={activeSection === 'grid-section' ? 'active-section' : ''}>
              <div className="prop-row">
                <label>Show grid</label>
                <input type="checkbox" checked={state.grid.enabled} onChange={(e) => updateGrid({ enabled: e.target.checked })} />
              </div>
              <div className="prop-row">
                <label>Size ({unit})</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={state.grid.size}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v > 0) updateGrid({ size: v });
                  }}
                />
              </div>
              <div className="prop-row">
                <label>Also show when projecting</label>
                <input type="checkbox" checked={state.grid.projectToo} onChange={(e) => updateGrid({ projectToo: e.target.checked })} />
              </div>
              <p className="hint">
                Dotted reference grid to help line up images. Off by default when projecting, since it's normally just an editing aid — turn this
                on if you actually want it visible on the wall too.
              </p>
            </section>

            <section id="nail-section" className={activeSection === 'nail-section' ? 'active-section' : ''}>
              <div className="prop-row">
                <label>Show dots</label>
                <input type="checkbox" checked={state.nail.enabled} onChange={(e) => updateNailGlobal({ enabled: e.target.checked })} />
              </div>
              <div className="prop-row">
                <label>Color</label>
                <input type="color" value={state.nail.color} onChange={(e) => updateNailGlobal({ color: e.target.value })} />
              </div>
              <div className="prop-row">
                <label>Size (px)</label>
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={state.nail.size}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v) && v > 0) updateNailGlobal({ size: v });
                  }}
                />
              </div>
              <p className="hint">
                Marks where to put the nail(s) on the wall for each image — visible while editing and while projecting. Color/size apply
                everywhere; each image can have multiple nails, positioned in cm from its top-left corner (drag the dot, or use Selected Image
                below). New images start with one nail centered.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
