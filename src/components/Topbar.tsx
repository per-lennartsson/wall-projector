'use client';

import React, { useEffect, useState } from 'react';
import type { ProjectCore } from '../hooks/useProjectCore';
import type { WallUnit } from '../types';

const UNITS: WallUnit[] = ['cm', 'm', 'in', 'px'];

interface TopbarProps {
  project: ProjectCore;
  /** Local mode renders <WorkspaceTabs/> here; cloud mode renders a
   * back-to-projects link + editable project name instead. */
  middleArea: React.ReactNode;
  appVersion: string;
  effectiveTheme: 'light' | 'dark';
  onToggleTheme: () => void;
  measureModeActive: boolean;
  onToggleMeasureMode: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  presenting: boolean;
  onTogglePresent: () => void;
  /** Local mode: a "Log in" link. Cloud mode: omitted (already signed in). */
  authArea?: React.ReactNode;
}

export function Topbar({
  project,
  middleArea,
  appVersion,
  effectiveTheme,
  onToggleTheme,
  measureModeActive,
  onToggleMeasureMode,
  onOpenHelp,
  onOpenSettings,
  presenting,
  onTogglePresent,
  authArea,
}: TopbarProps) {
  const { state, applyWallSize } = project;
  const [width, setWidth] = useState(state.wall.width);
  const [height, setHeight] = useState(state.wall.height);
  const [unit, setUnit] = useState<WallUnit>(state.wall.unit);

  useEffect(() => {
    setWidth(state.wall.width);
    setHeight(state.wall.height);
    setUnit(state.wall.unit);
  }, [state.wall.width, state.wall.height, state.wall.unit]);

  return (
    <header id="topbar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="13" rx="1.5" stroke="white" strokeWidth="2" />
            <path d="M8 21h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1>Wall Projector</h1>
        <span className="app-version" title="Build version">
          {appVersion}
        </span>
      </div>

      <div className="topbar-divider" />

      {middleArea}

      <div className="spacer" />

      <div className="field-group">
        <label>Wall</label>
        <input id="wall-width" type="number" min="1" step="0.1" value={width} onChange={(e) => setWidth(parseFloat(e.target.value))} />
        <span className="x">×</span>
        <input id="wall-height" type="number" min="1" step="0.1" value={height} onChange={(e) => setHeight(parseFloat(e.target.value))} />
        <div id="wall-unit-group" className="segmented">
          {UNITS.map((u) => (
            <button key={u} type="button" className={u === unit ? 'active' : ''} onClick={() => setUnit(u)}>
              {u}
            </button>
          ))}
        </div>
        <button onClick={() => applyWallSize(width || 1, height || 1, unit)}>Apply</button>
      </div>

      {authArea}

      <button className="icon-btn" title="Toggle theme" aria-label="Toggle theme" onClick={onToggleTheme}>
        {effectiveTheme === 'dark' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <button
        className={'icon-btn' + (measureModeActive ? ' active' : '')}
        title="Measure a distance on the wall (drag on empty wall space)"
        aria-label="Measure"
        onClick={onToggleMeasureMode}
      >
        📏
      </button>
      <button className="icon-btn" title="How to use" aria-label="How to use" onClick={onOpenHelp}>
        ?
      </button>
      <button className="icon-btn" title="Settings" aria-label="Settings" onClick={onOpenSettings}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 7h12M4 7H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16" cy="13" r="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M18 13h4M2 13h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="9" cy="19" r="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M11 19h11M2 19h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <button className="primary" onClick={onTogglePresent}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 4l14 8-14 8V4z" />
        </svg>
        <span>{presenting ? 'Exit' : 'Project'}</span>
      </button>
    </header>
  );
}
