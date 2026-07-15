import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameColor, ImageState, Nail, WallProjectState, WallUnit } from '../types';
import { normalizeState } from '../normalizeState';
import { cmToPctX, cmToPctY, pctToCmX, pctToCmY, recomputeImagesForWallResize } from '../geometry';

const UNDO_LIMIT = 50;
const SAVE_DEBOUNCE_MS = 300;

export interface SelectOptions {
  additive?: boolean;
}

export interface ProjectCoreOptions {
  /** Loads the initial project state. May be sync (local/localStorage) or async (cloud/API fetch). */
  bootstrap: () => WallProjectState | Promise<WallProjectState>;
  /** Called ~300ms after the last mutation (mirrors app.js's scheduleSave() debounce), and
   * synchronously from flushSave()/loadState(). Local mode writes to localStorage; cloud mode
   * PUTs to the API — this callback is the only thing that differs between the two modes. */
  onPersist: (state: WallProjectState) => void;
}

/**
 * Shared state/selection/undo-redo/mutation-action machinery, factored out of
 * what was originally a single `useProject()` hook so both local
 * (workspace/localStorage) and cloud (API-backed) editing can reuse the exact
 * same interaction logic without duplicating it — only `bootstrap`/`onPersist`
 * differ between the two. 1:1 port of app.js's state-mutation functions
 * (addImage, applyWallSize, etc.); see useProject.ts's original docstring
 * history for the invariants these must preserve (wall-resize aspect lock,
 * nail cm-offsets, frame padding, non-rotation-corrected drag math).
 */
export function useProjectCore({ bootstrap, onPersist }: ProjectCoreOptions) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<WallProjectState>(() => ({
    wall: { width: 300, height: 200, unit: 'cm' },
    images: [],
    ruler: { length: 100, visible: true, color: '#ffcc00' },
    background: { enabled: false, color: '#2a2a2a', projectToo: false },
    defaults: { imageWidth: 30, frameEnabled: false, frameColor: 'black', frameWidth: 3 },
    grid: { enabled: false, size: 20, projectToo: false },
    nail: { enabled: false, color: '#ff3b3b', size: 10 },
    keystone: { enabled: false, vertical: 0, horizontal: 0 },
  }));
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const nextIdRef = useRef(1);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const suppressNextSnapshotRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;
  const initedRef = useRef(false);

  // ---------- boot ----------
  useEffect(() => {
    if (initedRef.current) return; // guards against React.StrictMode's dev double-invoke
    initedRef.current = true;
    Promise.resolve(bootstrap()).then((initial) => {
      nextIdRef.current = initial.images.reduce((m, im) => Math.max(m, im.id + 1), 1);
      suppressNextSnapshotRef.current = true;
      setState(initial);
      undoStackRef.current = [JSON.stringify(initial)];
      redoStackRef.current = [];
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushUndoSnapshot() {
    const snap = JSON.stringify(stateRef.current);
    const stack = undoStackRef.current;
    if (stack.length && stack[stack.length - 1] === snap) return;
    stack.push(snap);
    if (stack.length > UNDO_LIMIT) stack.shift();
    redoStackRef.current = [];
  }

  // Debounced save, mirroring scheduleSave()/saveState(). Suppressed once
  // after loadState() (undo/redo/workspace-or-project-switch/import), which
  // persists synchronously itself instead of being treated as a new mutation.
  useEffect(() => {
    if (!ready) return;
    if (suppressNextSnapshotRef.current) {
      suppressNextSnapshotRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      onPersistRef.current(stateRef.current);
      pushUndoSnapshot();
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ready]);

  const flushSave = useCallback(() => {
    onPersistRef.current(stateRef.current);
    pushUndoSnapshot();
  }, []);

  // Wholesale state replacement — used for undo/redo, workspace/project
  // switching, and import. Persists synchronously (bypassing the debounce)
  // and resets undo/redo history to just this new state.
  const loadState = useCallback((newState: unknown) => {
    const normalized = normalizeState(JSON.parse(JSON.stringify(newState)));
    nextIdRef.current = normalized.images.reduce((m, im) => Math.max(m, im.id + 1), 1);
    onPersistRef.current(normalized);
    suppressNextSnapshotRef.current = true;
    setState(normalized);
    setSelectedIds(new Set());
    undoStackRef.current = [JSON.stringify(normalized)];
    redoStackRef.current = [];
  }, []);

  // Full state restore, shared by undo()/redo() — unlike loadState(), this
  // must NOT reset the undo/redo stacks (undo/redo manage those themselves).
  function loadStateInternal(newState: unknown) {
    const normalized = normalizeState(JSON.parse(JSON.stringify(newState)));
    nextIdRef.current = normalized.images.reduce((m, im) => Math.max(m, im.id + 1), 1);
    onPersistRef.current(normalized);
    suppressNextSnapshotRef.current = true;
    setState(normalized);
    setSelectedIds(new Set());
  }

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length < 2) return;
    const current = stack.pop()!;
    redoStackRef.current.push(current);
    loadStateInternal(JSON.parse(stack[stack.length - 1]));
  }, []);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (!stack.length) return;
    const snap = stack.pop()!;
    undoStackRef.current.push(snap);
    loadStateInternal(JSON.parse(snap));
  }, []);

  // ---------- selection ----------
  const selectImage = useCallback((id: number | null, opts: SelectOptions = {}) => {
    const { additive = false } = opts;
    setSelectedIds((prev) => {
      if (id === null) return new Set();
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const getSelected = useCallback((): ImageState | null => {
    if (!selectedIds.size) return null;
    const id = [...selectedIds][selectedIds.size - 1];
    return state.images.find((im) => im.id === id) || null;
  }, [selectedIds, state.images]);

  // ---------- wall ----------
  const applyWallSize = useCallback((width: number, height: number, unit: WallUnit) => {
    const prev = stateRef.current;
    const images = recomputeImagesForWallResize(prev.images, prev.wall, { width, height });
    setState({ ...prev, wall: { width, height, unit }, images });
  }, []);

  // ---------- images ----------
  const addImage = useCallback(
    (src: string, naturalW: number, naturalH: number, name: string, canvasRect: { width: number; height: number }) => {
      const prev = stateRef.current;
      const wPct = cmToPctX(prev.defaults.imageWidth, prev.wall.width);
      const desiredWidthPx = canvasRect.width * (wPct / 100);
      const aspect = naturalW && naturalH ? naturalH / naturalW : 1;
      const desiredHeightPx = desiredWidthPx * aspect;
      const hPct = canvasRect.height ? (desiredHeightPx / canvasRect.height) * 100 : wPct;

      const count = prev.images.length;
      const offset = (count % 6) * 3;
      const id = nextIdRef.current++;

      const imgState: ImageState = {
        id,
        src,
        name: name || `Image ${count + 1}`,
        xPct: 10 + offset,
        yPct: 10 + offset,
        wPct,
        hPct,
        rotation: 0,
        naturalW: naturalW || 0,
        naturalH: naturalH || 0,
        aspectLocked: true,
        crop: false,
        snapToGrid: false,
        frame: {
          enabled: prev.defaults.frameEnabled,
          color: prev.defaults.frameColor,
          width: prev.defaults.frameWidth,
        },
        nails: [{ xCm: pctToCmX(wPct, prev.wall.width) / 2, yCm: pctToCmY(hPct, prev.wall.height) / 2 }],
      };
      setState((s) => ({ ...s, images: [...s.images, imgState] }));
      setSelectedIds(new Set([id]));
    },
    [],
  );

  function urlToName(url: string): string {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || url;
    } catch {
      return url;
    }
  }

  const addImageFromFile = useCallback(
    (file: File, canvasRect: { width: number; height: number }) => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const probe = new Image();
        probe.onload = () => addImage(src, probe.naturalWidth, probe.naturalHeight, file.name, canvasRect);
        probe.onerror = () => addImage(src, 0, 0, file.name, canvasRect);
        probe.src = src;
      };
      reader.readAsDataURL(file);
    },
    [addImage],
  );

  const addImageFromUrl = useCallback(
    (url: string, canvasRect: { width: number; height: number }) => {
      if (!url) return;
      const probe = new Image();
      probe.onload = () => addImage(url, probe.naturalWidth, probe.naturalHeight, urlToName(url), canvasRect);
      probe.onerror = () => addImage(url, 0, 0, urlToName(url), canvasRect);
      probe.src = url;
    },
    [addImage],
  );

  const removeImage = useCallback((id: number) => {
    setState((s) => ({ ...s, images: s.images.filter((im) => im.id !== id) }));
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      return new Set();
    });
  }, []);

  const bulkRemoveSelected = useCallback(() => {
    setState((s) => ({ ...s, images: s.images.filter((im) => !selectedIds.has(im.id)) }));
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const bringToFront = useCallback((id: number) => {
    setState((s) => {
      const idx = s.images.findIndex((im) => im.id === id);
      if (idx === -1) return s;
      const images = [...s.images];
      const [im] = images.splice(idx, 1);
      images.push(im);
      return { ...s, images };
    });
  }, []);

  const bulkBringToFront = useCallback(() => {
    if (!selectedIds.size) return;
    setState((s) => {
      const selected = s.images.filter((im) => selectedIds.has(im.id));
      const rest = s.images.filter((im) => !selectedIds.has(im.id));
      return { ...s, images: [...rest, ...selected] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const bulkToggleFrame = useCallback(() => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setState((s) => {
      const first = s.images.find((im) => im.id === ids[0]);
      const nextEnabled = !(first && first.frame && first.frame.enabled);
      return {
        ...s,
        images: s.images.map((im) => (selectedIds.has(im.id) ? { ...im, frame: { ...im.frame, enabled: nextEnabled } } : im)),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const clearAll = useCallback(() => {
    if (!stateRef.current.images.length) return;
    if (!window.confirm('Remove all images?')) return;
    setState((s) => ({ ...s, images: [] }));
    setSelectedIds(new Set());
  }, []);

  // Generic per-image patch, used by the props panel and pointer gesture
  // hooks alike (drag/resize/rotate/nail-drag call this on every move).
  const updateImage = useCallback((id: number, patch: Partial<ImageState> | ((im: ImageState) => Partial<ImageState>)) => {
    setState((s) => ({
      ...s,
      images: s.images.map((im) => (im.id === id ? { ...im, ...(typeof patch === 'function' ? patch(im) : patch) } : im)),
    }));
  }, []);

  // Applies the same xPct/yPct delta to every image in the given id set —
  // used for multi-select group drag (a pure rigid translation).
  const translateImages = useCallback((ids: Set<number>, dxPct: number, dyPct: number) => {
    setState((s) => ({
      ...s,
      images: s.images.map((im) => (ids.has(im.id) ? { ...im, xPct: im.xPct + dxPct, yPct: im.yPct + dyPct } : im)),
    }));
  }, []);

  const addNail = useCallback((id: number) => {
    setState((s) => ({
      ...s,
      images: s.images.map((im) => {
        if (im.id !== id) return im;
        const wReal = pctToCmX(im.wPct, s.wall.width);
        const hReal = pctToCmY(im.hPct, s.wall.height);
        return { ...im, nails: [...im.nails, { xCm: wReal / 2, yCm: hReal / 2 }] };
      }),
    }));
  }, []);

  const updateNail = useCallback((id: number, nailIndex: number, patch: Partial<Nail>) => {
    setState((s) => ({
      ...s,
      images: s.images.map((im) =>
        im.id === id ? { ...im, nails: im.nails.map((n, i) => (i === nailIndex ? { ...n, ...patch } : n)) } : im,
      ),
    }));
  }, []);

  const removeNail = useCallback((id: number, nailIndex: number) => {
    setState((s) => ({
      ...s,
      images: s.images.map((im) => (im.id === id ? { ...im, nails: im.nails.filter((_, i) => i !== nailIndex) } : im)),
    }));
  }, []);

  // ---------- settings sub-object setters ----------
  const updateRuler = useCallback((patch: Partial<WallProjectState['ruler']>) => {
    setState((s) => ({ ...s, ruler: { ...s.ruler, ...patch } }));
  }, []);
  const updateBackground = useCallback((patch: Partial<WallProjectState['background']>) => {
    setState((s) => ({ ...s, background: { ...s.background, ...patch } }));
  }, []);
  const updateDefaults = useCallback((patch: Partial<WallProjectState['defaults']>) => {
    setState((s) => ({ ...s, defaults: { ...s.defaults, ...patch } }));
  }, []);
  const updateGrid = useCallback((patch: Partial<WallProjectState['grid']>) => {
    setState((s) => ({ ...s, grid: { ...s.grid, ...patch } }));
  }, []);
  const updateNailGlobal = useCallback((patch: Partial<WallProjectState['nail']>) => {
    setState((s) => ({ ...s, nail: { ...s.nail, ...patch } }));
  }, []);
  const updateKeystone = useCallback((patch: Partial<WallProjectState['keystone']>) => {
    setState((s) => ({ ...s, keystone: { ...s.keystone, ...patch } }));
  }, []);

  return {
    ready,
    state,
    selectedIds,
    selectImage,
    getSelected,
    undo,
    redo,
    loadState,
    flushSave,
    applyWallSize,
    addImage,
    addImageFromFile,
    addImageFromUrl,
    removeImage,
    bulkRemoveSelected,
    bringToFront,
    bulkBringToFront,
    bulkToggleFrame,
    clearAll,
    updateImage,
    translateImages,
    addNail,
    updateNail,
    removeNail,
    updateRuler,
    updateBackground,
    updateDefaults,
    updateGrid,
    updateNailGlobal,
    updateKeystone,
  };
}

export type ProjectCore = ReturnType<typeof useProjectCore>;
