import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectCore } from '../hooks/useProjectCore';
import type { LibraryImage } from '../types';
import { useUIPrefs } from '../hooks/useUIPrefs';
import { usePresentMode } from '../hooks/usePresentMode';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { Stage } from './Stage';
import { SettingsModal } from './SettingsModal';
import { HelpModal } from './HelpModal';

interface EditorShellProps {
  project: ProjectCore;
  /** Local mode: <WorkspaceTabs/>. Cloud mode: back-to-projects link + name. */
  middleArea: React.ReactNode;
  /** Local mode: export/import buttons. Cloud mode: single-project export
   * (or omitted). Passed straight through to SettingsModal. */
  fileSection?: React.ReactNode;
  authArea?: React.ReactNode;
  /** Backs the sidebar's "Choose from my images…" picker — sync local scan
   * in local mode, async API fetch in cloud mode. */
  imageLibrary: () => LibraryImage[] | Promise<LibraryImage[]>;
}

/**
 * The actual wall editor (topbar/sidebar/canvas/settings/help/keyboard
 * shortcuts/present-mode) — shared verbatim between local (no-login) mode
 * and cloud (logged-in) mode. Only the workspace-tabs-vs-project-nav area
 * and the settings modal's file section differ between the two; everything
 * else operates purely on the `project: ProjectCore` shape both
 * useProject() and useCloudProject() produce.
 */
export function EditorShell({ project, middleArea, fileSection, authArea, imageLibrary }: EditorShellProps) {
  const { prefs, effectiveTheme, setSidebarCollapsed, setLayersCompact, setTheme } = useUIPrefs();

  const [wallFrameEl, setWallFrameEl] = useState<HTMLDivElement | null>(null);
  const [wallCanvasEl, setWallCanvasEl] = useState<HTMLDivElement | null>(null);
  const { presenting, toggle: togglePresentRaw } = usePresentMode(wallFrameEl);
  const [measureModeActive, setMeasureModeActive] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const topbarRef = useRef<HTMLElement | null>(null);
  const [sidebarTop, setSidebarTop] = useState(0);

  // The sidebar floats over the canvas rather than pushing it aside, so it
  // needs to know the topbar's actual rendered height (which can grow if the
  // wall-size fields wrap on a narrow window) to sit just below it.
  useEffect(() => {
    const topbarEl = document.getElementById('topbar');
    topbarRef.current = topbarEl;
    if (!topbarEl) return;
    const recompute = () => setSidebarTop(topbarEl.getBoundingClientRect().height);
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(topbarEl);
    return () => observer.disconnect();
  }, []);

  function togglePresent() {
    if (!presenting) {
      project.selectImage(null);
      setSettingsOpen(false);
      setHelpOpen(false);
    }
    togglePresentRaw();
  }

  function toggleMeasureMode() {
    setMeasureModeActive((v) => !v);
    project.selectImage(null); // avoid measurement clicks fighting with drag handles
  }

  const getCanvasRect = useCallback(() => {
    if (!wallCanvasEl) return { width: 0, height: 0 };
    const rect = wallCanvasEl.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [wallCanvasEl]);

  // ---------- global keyboard shortcuts ----------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() || '';
      if (tag === 'input' || tag === 'select' || tag === 'textarea') {
        if (e.key === 'Escape') {
          if (settingsOpen) setSettingsOpen(false);
          if (helpOpen) setHelpOpen(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        if (helpOpen) setHelpOpen(false);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          project.undo();
          return;
        }
        if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          project.redo();
          return;
        }
      }
      if (!project.selectedIds.size) return;
      const targets = project.state.images.filter((im) => project.selectedIds.has(im.id));
      if (!targets.length) return;
      const step = e.shiftKey ? 2 : 0.5;
      let handled = true;
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          project.bulkRemoveSelected();
          break;
        case 'ArrowLeft':
          targets.forEach((im) => project.updateImage(im.id, { xPct: im.xPct - step }));
          break;
        case 'ArrowRight':
          targets.forEach((im) => project.updateImage(im.id, { xPct: im.xPct + step }));
          break;
        case 'ArrowUp':
          targets.forEach((im) => project.updateImage(im.id, { yPct: im.yPct - step }));
          break;
        case 'ArrowDown':
          targets.forEach((im) => project.updateImage(im.id, { yPct: im.yPct + step }));
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.selectedIds, project.state.images, settingsOpen, helpOpen]);

  const appVersion = `v${__APP_VERSION__}`;

  return (
    <div id="app">
      <Topbar
        project={project}
        middleArea={middleArea}
        appVersion={appVersion}
        effectiveTheme={effectiveTheme}
        onToggleTheme={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
        measureModeActive={measureModeActive}
        onToggleMeasureMode={toggleMeasureMode}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        presenting={presenting}
        onTogglePresent={togglePresent}
        authArea={authArea}
      />

      <div id="body-layout">
        <Sidebar
          project={project}
          sidebarCollapsed={prefs.sidebarCollapsed}
          layersCompact={prefs.layersCompact}
          onToggleCollapsed={() => setSidebarCollapsed(!prefs.sidebarCollapsed)}
          onToggleLayersCompact={() => setLayersCompact(!prefs.layersCompact)}
          getCanvasRect={getCanvasRect}
          topOffsetPx={sidebarTop}
          imageLibrary={imageLibrary}
        />

        <Stage
          project={project}
          presenting={presenting}
          measureModeActive={measureModeActive}
          onWallFrameEl={setWallFrameEl}
          onWallCanvasEl={setWallCanvasEl}
        />
      </div>

      <SettingsModal
        project={project}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={prefs.theme}
        onSetTheme={setTheme}
        fileSection={fileSection}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
