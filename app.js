(function () {
  // Replaced with the contents of the VERSION file at Docker image build
  // time (see Dockerfile); stays as the literal placeholder when running
  // straight from source (e.g. opened locally without a build step).
  const APP_VERSION = '__APP_VERSION__';

  const STORAGE_KEY = 'wallProjectorState.v1';
  const UI_STORAGE_KEY = 'wallProjectorUI.v1';

  const els = {
    wallWidth: document.getElementById('wall-width'),
    wallHeight: document.getElementById('wall-height'),
    wallUnitGroup: document.getElementById('wall-unit-group'),
    applySize: document.getElementById('apply-size'),
    presentBtn: document.getElementById('present-btn'),
    fileInput: document.getElementById('file-input'),
    urlInput: document.getElementById('url-input'),
    urlAdd: document.getElementById('url-add'),
    layersList: document.getElementById('layers-list'),
    layersEmpty: document.getElementById('layers-empty'),
    propsPanel: document.getElementById('props-panel'),
    clearAll: document.getElementById('clear-all'),
    wallFrame: document.getElementById('wall-frame'),
    wallCanvas: document.getElementById('wall-canvas'),
    wallWarp: document.getElementById('wall-warp'),
    topbar: document.getElementById('topbar'),
    sidebar: document.getElementById('sidebar'),
    rulerLength: document.getElementById('ruler-length'),
    rulerVisible: document.getElementById('ruler-visible'),
    rulerUnitLabel: document.getElementById('ruler-unit-label'),
    rulerColor: document.getElementById('ruler-color'),
    bgEnabled: document.getElementById('bg-enabled'),
    bgColor: document.getElementById('bg-color'),
    bgProject: document.getElementById('bg-project'),
    defaultWidth: document.getElementById('default-width'),
    defaultWidthUnit: document.getElementById('default-width-unit'),
    defaultFrameEnabled: document.getElementById('default-frame-enabled'),
    defaultFrameColor: document.getElementById('default-frame-color'),
    defaultFrameWidth: document.getElementById('default-frame-width'),
    defaultFrameWidthUnit: document.getElementById('default-frame-width-unit'),
    keystoneEnabled: document.getElementById('keystone-enabled'),
    keystoneVertical: document.getElementById('keystone-vertical'),
    keystoneHorizontal: document.getElementById('keystone-horizontal'),
    measureBtn: document.getElementById('measure-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    settingsClose: document.getElementById('settings-close'),
    helpBtn: document.getElementById('help-btn'),
    helpModal: document.getElementById('help-modal'),
    helpClose: document.getElementById('help-close'),
    gridEnabled: document.getElementById('grid-enabled'),
    gridSize: document.getElementById('grid-size'),
    gridSizeUnit: document.getElementById('grid-size-unit'),
    gridProject: document.getElementById('grid-project'),
    nailEnabled: document.getElementById('nail-enabled'),
    nailColor: document.getElementById('nail-color'),
    nailSize: document.getElementById('nail-size'),
    exportBtn: document.getElementById('export-btn'),
    exportAllBtn: document.getElementById('export-all-btn'),
    importBtn: document.getElementById('import-btn'),
    importFileInput: document.getElementById('import-file-input'),
    sidebarCollapseBtn: document.getElementById('sidebar-collapse-btn'),
    layersCompactToggle: document.getElementById('layers-compact-toggle'),
    themePicker: document.getElementById('theme-picker'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    appVersion: document.getElementById('app-version'),
    workspaceTabs: document.getElementById('workspace-tabs'),
    workspaceAddBtn: document.getElementById('workspace-add-btn'),
    settingsNavItems: document.querySelectorAll('.settings-nav-item'),
    settingsTitle: document.getElementById('settings-title'),
  };

  // ---------- segmented button groups (unit picker, theme picker) ----------
  // Small helper shared by the wall-unit and theme pickers: both are a
  // container of <button data-*="value"> where exactly one has `.active`.
  function segmentedValue(container, dataAttr) {
    const active = container.querySelector('button.active');
    return active ? active.dataset[dataAttr] : null;
  }
  function setSegmentedValue(container, dataAttr, value) {
    container.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset[dataAttr] === value);
    });
  }
  function getWallUnit() {
    return segmentedValue(els.wallUnitGroup, 'unit');
  }
  function setWallUnit(unit) {
    setSegmentedValue(els.wallUnitGroup, 'unit', unit);
  }
  els.wallUnitGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-unit]');
    if (!btn) return;
    setWallUnit(btn.dataset.unit);
  });

  const FRAME_COLORS = ['light-wood', 'dark-wood', 'black', 'white'];

  function makeDefaultState() {
    return {
      wall: { width: 300, height: 200, unit: 'cm' },
      images: [], // {id, src, name, xPct, yPct, wPct, hPct, rotation, naturalW, naturalH, frame, nails: [{xCm, yCm}]}
      ruler: { length: 100, visible: true, color: '#ffcc00' },
      background: { enabled: false, color: '#2a2a2a', projectToo: false },
      defaults: { imageWidth: 30, frameEnabled: false, frameColor: 'black', frameWidth: 3 },
      grid: { enabled: false, size: 20, projectToo: false },
      nail: { enabled: false, color: '#ff3b3b', size: 10 },
      keystone: { enabled: false, vertical: 0, horizontal: 0 },
    };
  }

  let state = makeDefaultState();

  let nextId = 1;
  let selectedIds = new Set();
  const elMap = new Map(); // id -> { root, imgEl }

  // ---------- measurement mode ----------
  // Fully ephemeral UI, like the selection state above — never persisted.
  let measureModeActive = false;

  // ---------- undo/redo ----------
  // History of committed JSON-serialized `state` snapshots, current state is
  // always the top of undoStack. Piggybacks on saveState() (the one choke
  // point nearly every mutation already flows through via scheduleSave's
  // debounce) rather than a full mutation-dispatcher rewrite. Deliberately
  // module-level, not part of persisted `state` — same reasoning as selectedIds.
  let undoStack = [];
  let redoStack = [];
  const UNDO_LIMIT = 50;

  function pushUndoSnapshot() {
    const snap = JSON.stringify(state);
    if (undoStack.length && undoStack[undoStack.length - 1] === snap) return;
    undoStack.push(snap);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack = [];
  }

  function resetUndoHistory() {
    undoStack = [JSON.stringify(state)];
    redoStack = [];
  }

  // Full state restore + re-render, shared by undo() and redo(). Persists the
  // restored state directly (bypassing saveState()/pushUndoSnapshot, which
  // would otherwise corrupt the stacks by treating the restore itself as a
  // new mutation) and rebuilds all DOM via the same teardown/hydrate pair
  // already used for workspace switching and file import.
  function restoreState(newState) {
    state = normalizeState(newState);
    nextId = state.images.reduce((m, im) => Math.max(m, im.id + 1), 1);
    try {
      localStorage.setItem(workspaceStateKey(activeWorkspaceId), JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save state', e);
    }
    teardownDOM();
    hydrateFromState();
    selectImage(null);
  }

  function undo() {
    if (undoStack.length < 2) return;
    const current = undoStack.pop();
    redoStack.push(current);
    restoreState(JSON.parse(undoStack[undoStack.length - 1]));
  }

  function redo() {
    if (!redoStack.length) return;
    const snap = redoStack.pop();
    undoStack.push(snap);
    restoreState(JSON.parse(snap));
  }

  // ---------- workspaces ----------
  const WORKSPACES_KEY = 'wallProjectorWorkspaces.v1';
  let workspaces = []; // [{id, name}]
  let activeWorkspaceId = null;

  // ---------- persistence ----------
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 300);
  }
  function saveState() {
    try {
      localStorage.setItem(workspaceStateKey(activeWorkspaceId), JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save state', e);
    }
    pushUndoSnapshot();
  }
  // Fills in defaults for any fields missing from an older save (or a file
  // from an older version of the app) and migrates deprecated formats.
  // Shared by activateWorkspaceState() (from localStorage) and file import, so both
  // apply the exact same rules. Mutates and returns the given object; throws
  // if it doesn't look like a wall-projector state at all.
  // Numeric/enum fields below get interpolated straight into innerHTML
  // templates in renderProps() (e.g. `${unit}`, `${frame.width}`) without
  // further escaping — an imported project file (the app's own "share"
  // mechanism) with e.g. `"unit": "<img src=x onerror=...>"` would otherwise
  // execute script when the props panel renders. Whitelisting/coercing here,
  // once, closes that off for every render site at once.
  const WALL_UNITS = ['cm', 'm', 'in', 'px'];

  function toFiniteNumber(v, fallback) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeState(parsed) {
    if (!parsed || !parsed.wall || !Array.isArray(parsed.images)) {
      throw new Error('Not a wall-projector project file');
    }
    if (!WALL_UNITS.includes(parsed.wall.unit)) parsed.wall.unit = 'cm';
    parsed.wall.width = toFiniteNumber(parsed.wall.width, 300);
    parsed.wall.height = toFiniteNumber(parsed.wall.height, 200);

    if (!parsed.ruler) parsed.ruler = { length: 100, visible: true, color: '#ffcc00' };
    if (!parsed.ruler.color) parsed.ruler.color = '#ffcc00';
    parsed.ruler.length = toFiniteNumber(parsed.ruler.length, 100);
    if (!parsed.background) parsed.background = { enabled: false, color: '#2a2a2a', projectToo: false };
    if (parsed.background.projectToo === undefined) parsed.background.projectToo = false;
    if (!parsed.defaults) {
      parsed.defaults = { imageWidth: 30, frameEnabled: false, frameColor: 'black', frameWidth: 3 };
    }
    if (!FRAME_COLORS.includes(parsed.defaults.frameColor)) parsed.defaults.frameColor = 'black';
    parsed.defaults.imageWidth = toFiniteNumber(parsed.defaults.imageWidth, 30);
    parsed.defaults.frameWidth = toFiniteNumber(parsed.defaults.frameWidth, 3);
    if (!parsed.grid) parsed.grid = { enabled: false, size: 20, projectToo: false };
    if (parsed.grid.projectToo === undefined) parsed.grid.projectToo = false;
    parsed.grid.size = toFiniteNumber(parsed.grid.size, 20);
    if (!parsed.nail) parsed.nail = { enabled: false, color: '#ff3b3b', size: 10 };
    parsed.nail.size = toFiniteNumber(parsed.nail.size, 10);
    if (!parsed.keystone) parsed.keystone = { enabled: false, vertical: 0, horizontal: 0 };
    parsed.keystone.vertical = toFiniteNumber(parsed.keystone.vertical, 0);
    parsed.keystone.horizontal = toFiniteNumber(parsed.keystone.horizontal, 0);
    parsed.images.forEach((im) => {
      if (!im.frame) im.frame = { enabled: false, color: 'black', width: 3 };
      if (!FRAME_COLORS.includes(im.frame.color)) im.frame.color = 'black';
      im.frame.width = toFiniteNumber(im.frame.width, 3);
      im.xPct = toFiniteNumber(im.xPct, 0);
      im.yPct = toFiniteNumber(im.yPct, 0);
      im.wPct = toFiniteNumber(im.wPct, 10);
      im.hPct = toFiniteNumber(im.hPct, 10);
      im.rotation = toFiniteNumber(im.rotation, 0);
      im.naturalW = toFiniteNumber(im.naturalW, 0);
      im.naturalH = toFiniteNumber(im.naturalH, 0);
      if (!Array.isArray(im.nails)) {
        const wReal = (im.wPct / 100) * parsed.wall.width;
        const hReal = (im.hPct / 100) * parsed.wall.height;
        if (im.nailXPct !== undefined && im.nailYPct !== undefined) {
          // migrate from the old single-nail, box-relative-percentage format
          im.nails = [{ xCm: (im.nailXPct / 100) * wReal, yCm: (im.nailYPct / 100) * hReal }];
        } else {
          im.nails = [{ xCm: wReal / 2, yCm: hReal / 2 }];
        }
      }
      im.nails.forEach((n) => {
        n.xCm = toFiniteNumber(n.xCm, 0);
        n.yCm = toFiniteNumber(n.yCm, 0);
      });
      delete im.nailXPct;
      delete im.nailYPct;
      if (im.aspectLocked === undefined) im.aspectLocked = true;
      if (im.crop === undefined) im.crop = false;
      if (im.snapToGrid === undefined) im.snapToGrid = false;
    });
    return parsed;
  }

  function workspaceStateKey(id) {
    return `${STORAGE_KEY}.${id}`;
  }

  function saveWorkspaceIndex() {
    try {
      localStorage.setItem(WORKSPACES_KEY, JSON.stringify({ workspaces, activeId: activeWorkspaceId }));
    } catch (e) {
      console.warn('Could not save workspace index', e);
    }
  }

  function readWorkspaceState(id) {
    try {
      const raw = localStorage.getItem(workspaceStateKey(id));
      if (!raw) return null;
      return normalizeState(JSON.parse(raw));
    } catch (e) {
      console.warn('Could not load workspace state', e);
      return null;
    }
  }

  // Populates `workspaces`/`activeWorkspaceId` from the index key. On first
  // ever run (no index yet), migrates a pre-workspaces single-project save
  // (the old bare STORAGE_KEY) into one "Wall" workspace, or seeds a fresh
  // default workspace if there was nothing saved at all.
  function loadWorkspaces() {
    try {
      const raw = localStorage.getItem(WORKSPACES_KEY);
      if (raw) {
        const idx = JSON.parse(raw);
        if (idx && Array.isArray(idx.workspaces) && idx.workspaces.length) {
          workspaces = idx.workspaces;
          activeWorkspaceId = workspaces.some((w) => w.id === idx.activeId) ? idx.activeId : workspaces[0].id;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load workspace index', e);
    }

    const id = 'default';
    workspaces = [{ id, name: 'Wall' }];
    activeWorkspaceId = id;
    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    if (legacyRaw) {
      try {
        localStorage.setItem(workspaceStateKey(id), legacyRaw);
      } catch (e) {
        console.warn('Could not migrate legacy save', e);
      }
    }
    saveWorkspaceIndex();
  }

  // Loads the given workspace's project data into `state`/`nextId` (falling
  // back to a fresh default project if nothing is saved for it yet).
  function activateWorkspaceState(id) {
    state = readWorkspaceState(id) || makeDefaultState();
    nextId = state.images.reduce((m, im) => Math.max(m, im.id + 1), 1);
  }

  function switchWorkspace(id) {
    if (id === activeWorkspaceId) return;
    // Flush any pending debounced save for the OLD workspace before
    // reassigning activeWorkspaceId, so it doesn't get written under the
    // new workspace's key.
    clearTimeout(saveTimer);
    saveState();
    activeWorkspaceId = id;
    teardownDOM();
    activateWorkspaceState(id);
    hydrateFromState();
    resetUndoHistory();
    renderWorkspaceTabs();
    saveWorkspaceIndex();
  }

  function createWorkspace() {
    clearTimeout(saveTimer);
    saveState();
    const id = 'ws-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    workspaces.push({ id, name: `Workspace ${workspaces.length + 1}` });
    try {
      localStorage.setItem(workspaceStateKey(id), JSON.stringify(makeDefaultState()));
    } catch (e) {
      console.warn('Could not create workspace', e);
    }
    activeWorkspaceId = id;
    teardownDOM();
    activateWorkspaceState(id);
    hydrateFromState();
    resetUndoHistory();
    renderWorkspaceTabs();
    saveWorkspaceIndex();
  }

  function deleteWorkspace(id) {
    if (workspaces.length <= 1) return;
    if (!confirm('Delete this workspace? This cannot be undone.')) return;
    const idx = workspaces.findIndex((w) => w.id === id);
    if (idx === -1) return;
    workspaces.splice(idx, 1);
    try {
      localStorage.removeItem(workspaceStateKey(id));
    } catch (e) {
      console.warn('Could not remove workspace storage', e);
    }
    if (activeWorkspaceId === id) {
      const nextActive = workspaces[Math.max(0, idx - 1)].id;
      activeWorkspaceId = nextActive;
      teardownDOM();
      activateWorkspaceState(nextActive);
      hydrateFromState();
      resetUndoHistory();
    }
    renderWorkspaceTabs();
    saveWorkspaceIndex();
  }

  function renderWorkspaceTabs() {
    els.workspaceTabs.querySelectorAll('.tab').forEach((el) => el.remove());
    workspaces.forEach((ws) => {
      const tab = document.createElement('div');
      tab.className = 'tab' + (ws.id === activeWorkspaceId ? ' active' : '');
      tab.dataset.id = ws.id;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tab-name';
      nameSpan.textContent = ws.name;
      tab.appendChild(nameSpan);

      tab.addEventListener('click', () => {
        if (ws.id !== activeWorkspaceId) switchWorkspace(ws.id);
      });
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startRenameTab(tab, ws, nameSpan);
      });

      if (workspaces.length > 1) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Delete workspace';
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteWorkspace(ws.id);
        });
        tab.appendChild(closeBtn);
      }

      els.workspaceTabs.insertBefore(tab, els.workspaceAddBtn);
    });
  }

  function startRenameTab(tab, ws, nameSpan) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-name-edit';
    input.value = ws.name;
    tab.replaceChild(input, nameSpan);
    input.focus();
    input.select();
    input.addEventListener('click', (e) => e.stopPropagation());
    function commit() {
      const v = input.value.trim();
      if (v) ws.name = v;
      saveWorkspaceIndex();
      renderWorkspaceTabs();
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        input.value = ws.name;
        input.blur();
      }
    });
  }

  // ---------- UI prefs (sidebar collapse / layers density / theme) ----------
  // Kept in their own localStorage key, separate from the project state,
  // since these are per-browser display preferences rather than project data.
  let uiPrefs = { sidebarCollapsed: false, layersCompact: false, theme: 'dark' };

  function loadUIPrefs() {
    try {
      const raw = localStorage.getItem(UI_STORAGE_KEY);
      if (raw) uiPrefs = Object.assign(uiPrefs, JSON.parse(raw));
    } catch (e) {
      console.warn('Could not load UI prefs', e);
    }
  }
  function saveUIPrefs() {
    try {
      localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiPrefs));
    } catch (e) {
      console.warn('Could not save UI prefs', e);
    }
  }
  function setSidebarCollapsed(collapsed) {
    uiPrefs.sidebarCollapsed = collapsed;
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    els.sidebarCollapseBtn.classList.toggle('collapsed', collapsed);
    els.sidebarCollapseBtn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    saveUIPrefs();
  }
  function setLayersCompact(compact) {
    uiPrefs.layersCompact = compact;
    document.body.classList.toggle('layers-compact', compact);
    saveUIPrefs();
  }

  // 'system' resolves live via the OS/browser's prefers-color-scheme, so the
  // app can follow it without a page reload (see the matchMedia listener
  // wired up below, near the rest of init).
  const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function resolveEffectiveTheme() {
    if (uiPrefs.theme === 'light' || uiPrefs.theme === 'dark') return uiPrefs.theme;
    return systemThemeQuery && systemThemeQuery.matches ? 'light' : 'dark';
  }
  function applyTheme() {
    const effective = resolveEffectiveTheme();
    document.documentElement.setAttribute('data-theme', effective);
    // Swaps which of the two SVGs inside the theme-toggle button is shown
    // (sun when currently dark, so clicking it suggests switching to light —
    // and vice versa), independent of the Settings picker's own state.
    els.themeToggleBtn.classList.toggle('theme-dark', effective === 'dark');
    els.themeToggleBtn.classList.toggle('theme-light', effective === 'light');
  }
  function setTheme(theme) {
    uiPrefs.theme = theme;
    applyTheme();
    saveUIPrefs();
  }

  // ---------- wall ----------
  function applyWallSize() {
    const w = parseFloat(els.wallWidth.value) || 1;
    const h = parseFloat(els.wallHeight.value) || 1;

    // wPct/hPct/xPct/yPct are each relative to the wall's own width/height,
    // so if only one dimension changes, an image's real-world size and
    // position would otherwise skew (and its aspect ratio would break).
    // Capture real-world geometry under the OLD wall size first, then
    // re-derive percentages under the NEW size so images keep their
    // physical size/position on the wall.
    const real = state.images.map((im) => ({
      im,
      xCm: pctToCmX(im.xPct),
      yCm: pctToCmY(im.yPct),
      wCm: pctToCmX(im.wPct),
      hCm: pctToCmY(im.hPct),
    }));

    state.wall = { width: w, height: h, unit: getWallUnit() };

    real.forEach(({ im, xCm, yCm, wCm, hCm }) => {
      im.xPct = cmToPctX(xCm);
      im.yPct = cmToPctY(yCm);
      im.wPct = cmToPctX(wCm);
      im.hPct = cmToPctY(hCm);
    });

    fitCanvas();
    renderRuler();
    renderProps();
    renderDefaultsUnitLabels();
    state.images.forEach(applyTransform); // also refreshes frame thickness, which is wall-size dependent
    scheduleSave();
  }

  function renderDefaultsUnitLabels() {
    els.defaultWidthUnit.textContent = state.wall.unit;
    els.defaultFrameWidthUnit.textContent = state.wall.unit;
  }

  // Real-world units <-> canvas percentages. The wall's width/height define
  // what one percent along each axis is worth in the wall's chosen unit.
  function cmToPctX(v) {
    return (v / state.wall.width) * 100;
  }
  function cmToPctY(v) {
    return (v / state.wall.height) * 100;
  }
  function pctToCmX(pct) {
    return (pct / 100) * state.wall.width;
  }
  function pctToCmY(pct) {
    return (pct / 100) * state.wall.height;
  }
  // Rounds a real-world cm coordinate to the nearest grid line, using the
  // grid's cell size regardless of whether the grid is currently visible
  // (the "snap to grid" per-image toggle works independently of that).
  function snapCmToGrid(cm) {
    const size = state.grid.size;
    return size > 0 ? Math.round(cm / size) * size : cm;
  }

  // The canvas has no intrinsic size of its own (it's a flex item centered
  // in #wall-frame), so we compute its pixel box explicitly from the wall's
  // aspect ratio and whatever space #wall-frame currently has available.
  // This re-runs on window resize and on entering/exiting fullscreen.
  function fitCanvas() {
    const rect = els.wallFrame.getBoundingClientRect();
    const availW = rect.width;
    const availH = rect.height;
    if (availW <= 0 || availH <= 0) return;
    const ratio = state.wall.width / state.wall.height;
    let w, h;
    if (availW / availH > ratio) {
      h = availH;
      w = h * ratio;
    } else {
      w = availW;
      h = w / ratio;
    }
    els.wallCanvas.style.width = w + 'px';
    els.wallCanvas.style.height = h + 'px';
    renderGrid(); // grid cell size is computed in px, so it must track canvas size changes too
    applyKeystone(); // perspective distance is derived from canvas size too
  }

  // ---------- keystone correction ----------
  // A trapezoid (converging top/bottom or left/right edges) can't be produced
  // by a 2D affine transform — it's inherently a perspective effect. Rather
  // than hand-deriving a matrix3d homography, this leans on the browser's
  // built-in perspective projection: a single rotateX corrects a top/bottom
  // width mismatch (projector mounted above/below center), a single rotateY
  // corrects left/right (projector off to one side) — the same two axes
  // real projectors' own "V/H keystone" controls expose. Applied to
  // #wall-warp, so every child (images, grid, ruler) warps together.
  function applyKeystone() {
    if (!els.wallWarp) return;
    if (!state.keystone.enabled || (!state.keystone.vertical && !state.keystone.horizontal)) {
      els.wallWarp.style.transform = '';
      return;
    }
    const rect = els.wallCanvas.getBoundingClientRect();
    const perspectivePx = Math.max(rect.width, rect.height, 1) * 1.5;
    els.wallWarp.style.transform =
      `perspective(${perspectivePx}px) ` +
      `rotateX(${state.keystone.vertical}deg) ` +
      `rotateY(${state.keystone.horizontal}deg)`;
  }

  // ---------- images ----------
  function addImage(src, naturalW, naturalH, name) {
    const wPct = cmToPctX(state.defaults.imageWidth);
    const rect = els.wallCanvas.getBoundingClientRect();
    const desiredWidthPx = rect.width * (wPct / 100);
    const aspect = naturalW && naturalH ? naturalH / naturalW : 1;
    const desiredHeightPx = desiredWidthPx * aspect;
    const hPct = rect.height ? (desiredHeightPx / rect.height) * 100 : wPct;

    const count = state.images.length;
    const offset = (count % 6) * 3;

    const imgState = {
      id: nextId++,
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
        enabled: state.defaults.frameEnabled,
        color: state.defaults.frameColor,
        width: state.defaults.frameWidth,
      },
      // one nail, centered on the photo by default (in cm from its top-left corner)
      nails: [{ xCm: pctToCmX(wPct) / 2, yCm: pctToCmY(hPct) / 2 }],
    };
    state.images.push(imgState);
    renderImage(imgState);
    selectImage(imgState.id);
    renderLayersList();
    scheduleSave();
  }

  function addImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      const probe = new Image();
      probe.onload = () => addImage(src, probe.naturalWidth, probe.naturalHeight, file.name);
      probe.onerror = () => addImage(src, 0, 0, file.name);
      probe.src = src;
    };
    reader.readAsDataURL(file);
  }

  function addImageFromUrl(url) {
    if (!url) return;
    const probe = new Image();
    probe.onload = () => addImage(url, probe.naturalWidth, probe.naturalHeight, urlToName(url));
    probe.onerror = () => addImage(url, 0, 0, urlToName(url));
    probe.src = url;
  }

  function urlToName(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || url;
    } catch (e) {
      return url;
    }
  }

  function removeImage(id) {
    state.images = state.images.filter((im) => im.id !== id);
    const rec = elMap.get(id);
    if (rec) rec.root.remove();
    elMap.delete(id);
    if (selectedIds.has(id)) selectImage(null);
    renderLayersList();
    scheduleSave();
  }

  // Removes every currently-selected image in one go (bulk delete / Delete key).
  function bulkRemoveSelected() {
    const ids = [...selectedIds];
    ids.forEach((id) => {
      state.images = state.images.filter((im) => im.id !== id);
      const rec = elMap.get(id);
      if (rec) rec.root.remove();
      elMap.delete(id);
    });
    selectImage(null);
    renderLayersList();
    scheduleSave();
  }

  // Bulk version of bringToFront: preserves the selected images' relative
  // order among themselves while moving the whole group above everything else.
  function bulkBringToFront() {
    const ids = new Set(selectedIds);
    if (!ids.size) return;
    const selected = state.images.filter((im) => ids.has(im.id));
    state.images = state.images.filter((im) => !ids.has(im.id)).concat(selected);
    reindexZ();
    renderLayersList();
    scheduleSave();
  }

  // Toggles frame.enabled for every selected image, using the *first*
  // selected image's current value as the toggle direction so a mixed
  // selection converges to one state rather than flipping each independently.
  function bulkToggleFrame() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const first = state.images.find((im) => im.id === ids[0]);
    const nextEnabled = !(first && first.frame && first.frame.enabled);
    ids.forEach((id) => {
      const im = state.images.find((i) => i.id === id);
      if (im && im.frame) {
        im.frame.enabled = nextEnabled;
        applyTransform(im);
      }
    });
    scheduleSave();
  }

  function clearAll() {
    if (!state.images.length) return;
    if (!confirm('Remove all images?')) return;
    state.images.forEach((im) => {
      const rec = elMap.get(im.id);
      if (rec) rec.root.remove();
    });
    elMap.clear();
    state.images = [];
    selectImage(null);
    renderLayersList();
    scheduleSave();
  }

  function bringToFront(id) {
    const idx = state.images.findIndex((im) => im.id === id);
    if (idx === -1) return;
    const [im] = state.images.splice(idx, 1);
    state.images.push(im);
    reindexZ();
    renderLayersList();
    scheduleSave();
  }

  function reindexZ() {
    state.images.forEach((im, i) => {
      const rec = elMap.get(im.id);
      if (rec) rec.root.style.zIndex = String(i + 1);
    });
  }

  // ---------- rendering ----------
  function renderImage(imgState) {
    const root = document.createElement('div');
    root.className = 'wall-image';
    root.dataset.id = String(imgState.id);

    // frameEl is painted first (so it sits behind), imgEl after (on top) —
    // both are positioned elements so DOM order alone decides stacking.
    const frameEl = document.createElement('div');
    frameEl.className = 'wall-image-frame';
    root.appendChild(frameEl);

    const imgEl = document.createElement('img');
    imgEl.src = imgState.src;
    imgEl.draggable = false;
    root.appendChild(imgEl);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'handle handle-resize';
    root.appendChild(resizeHandle);

    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'handle handle-rotate';
    root.appendChild(rotateHandle);

    els.wallWarp.appendChild(root);
    elMap.set(imgState.id, { root, imgEl, frameEl, nailEls: [] });
    renderNailDots(imgState); // also applies the initial transform

    reindexZ();

    root.addEventListener('pointerdown', (e) => {
      if (e.target === resizeHandle || e.target === rotateHandle || e.target.classList.contains('nail-dot')) return;
      e.preventDefault();
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const partOfExistingMultiSelection = selectedIds.has(imgState.id) && selectedIds.size > 1;
      if (additive) {
        selectImage(imgState.id, { additive: true });
      } else if (!partOfExistingMultiSelection) {
        // A plain click on an image that's already part of a multi-selection
        // keeps the whole selection intact, so the drag below can move the
        // group — only replace the selection (and bring-to-front) when it isn't.
        selectImage(imgState.id);
        bringToFront(imgState.id);
      }
      startDrag(e, imgState);
    });

    resizeHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectImage(imgState.id);
      startResize(e, imgState);
    });

    rotateHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectImage(imgState.id);
      startRotate(e, imgState);
    });
  }

  // Rebuilds the hanging-point dot elements for one image from its `nails`
  // array. Called on initial render and whenever a nail is added/removed
  // (repositioning alone just updates existing dots via applyTransform).
  function renderNailDots(imgState) {
    const rec = elMap.get(imgState.id);
    if (!rec) return;
    rec.nailEls.forEach((el) => el.remove());
    rec.nailEls = imgState.nails.map((nail) => {
      // Not gated by .selected in CSS — stays visible (and draggable) in
      // both edit and Present mode, since its purpose is marking the wall.
      const nailEl = document.createElement('div');
      nailEl.className = 'nail-dot';
      nailEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectImage(imgState.id);
        startNailDrag(e, nail, imgState);
      });
      rec.root.appendChild(nailEl);
      return nailEl;
    });
    applyTransform(imgState);
  }

  function applyTransform(imgState) {
    const rec = elMap.get(imgState.id);
    if (!rec) return;
    const { root, imgEl, frameEl, nailEls } = rec;
    imgEl.style.objectFit = imgState.crop ? 'cover' : 'fill';

    // Nail positions are stored as cm offsets from the photo's own top-left
    // corner (so they stay physically meaningful regardless of image size),
    // converted here to a percentage of the photo's own box for CSS.
    const boxWidthRealForNail = pctToCmX(imgState.wPct);
    const boxHeightRealForNail = pctToCmY(imgState.hPct);
    imgState.nails.forEach((nail, i) => {
      const el = nailEls[i];
      if (!el) return;
      el.style.left = (boxWidthRealForNail > 0 ? (nail.xCm / boxWidthRealForNail) * 100 : 0) + '%';
      el.style.top = (boxHeightRealForNail > 0 ? (nail.yCm / boxHeightRealForNail) * 100 : 0) + '%';
    });

    root.style.left = imgState.xPct + '%';
    root.style.top = imgState.yPct + '%';
    root.style.width = imgState.wPct + '%';
    root.style.height = imgState.hPct + '%';
    root.style.transform = `rotate(${imgState.rotation}deg)`;

    const frame = imgState.frame;
    if (frame && frame.enabled) {
      // The frame grows the footprint outward from the photo's own box
      // (root), rather than shrinking the photo inside a fixed footprint.
      // top/bottom percentages resolve against the box's own height and
      // left/right against its width, so computing them separately (instead
      // of one shared percentage) keeps the border an even physical
      // thickness on all four sides.
      const boxWidthReal = pctToCmX(imgState.wPct);
      const boxHeightReal = pctToCmY(imgState.hPct);
      const leftRightPct = boxWidthReal > 0 ? Math.max(0, (frame.width / boxWidthReal) * 100) : 0;
      const topBottomPct = boxHeightReal > 0 ? Math.max(0, (frame.width / boxHeightReal) * 100) : 0;
      frameEl.style.left = `-${leftRightPct}%`;
      frameEl.style.right = `-${leftRightPct}%`;
      frameEl.style.top = `-${topBottomPct}%`;
      frameEl.style.bottom = `-${topBottomPct}%`;
      frameEl.className = 'wall-image-frame frame-' + frame.color;
    } else {
      frameEl.style.left = '0';
      frameEl.style.right = '0';
      frameEl.style.top = '0';
      frameEl.style.bottom = '0';
      frameEl.className = 'wall-image-frame';
    }
  }

  // ---------- selection ----------
  // id === null clears the whole selection. Otherwise, additive (shift/ctrl/
  // cmd-click) toggles that id's membership in the set; a plain click
  // replaces the set with just that one id.
  function selectImage(id, opts = {}) {
    const { additive = false } = opts;
    if (id === null) {
      selectedIds.clear();
    } else if (additive) {
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
    } else {
      selectedIds = new Set([id]);
    }
    elMap.forEach((rec, imId) => {
      rec.root.classList.toggle('selected', selectedIds.has(imId));
    });
    document.querySelectorAll('.layer-item').forEach((li) => {
      li.classList.toggle('selected', selectedIds.has(Number(li.dataset.id)));
    });
    renderProps();
  }

  // Returns the "primary" selected image (most-recently added to the set) —
  // the single-image call sites (resize/rotate/nail-drag, props panel body,
  // arrow-key nudge) all key off this, unchanged from the old singular model.
  function getSelected() {
    if (!selectedIds.size) return null;
    const id = [...selectedIds][selectedIds.size - 1];
    return state.images.find((im) => im.id === id) || null;
  }

  // ---------- drag / resize / rotate ----------
  // If the dragged image is part of a multi-image selection, every selected
  // image moves together by the same screen-space delta (a pure translation,
  // so it's correct regardless of each image's own rotation — unlike
  // resize/rotate, which stay single-image-only, see startResize/startRotate).
  function startDrag(e, imgState) {
    const rect = els.wallCanvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const targets =
      selectedIds.has(imgState.id) && selectedIds.size > 1
        ? state.images.filter((im) => selectedIds.has(im.id))
        : [imgState];
    const starts = targets.map((im) => ({ im, xPct: im.xPct, yPct: im.yPct }));

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const dxPct = (dx / rect.width) * 100;
      const dyPct = (dy / rect.height) * 100;

      if (starts.length > 1) {
        // Group drag: pure rigid translation, no per-image grid/alignment
        // snapping — snapping would apply a different correction to each
        // image and break the group's relative layout.
        starts.forEach(({ im, xPct, yPct }) => {
          im.xPct = xPct + dxPct;
          im.yPct = yPct + dyPct;
          applyTransform(im);
        });
        renderProps();
        return;
      }

      const { im, xPct, yPct } = starts[0];
      im.xPct = xPct + dxPct;
      im.yPct = yPct + dyPct;

      if (im.snapToGrid) {
        im.xPct = cmToPctX(snapCmToGrid(pctToCmX(im.xPct)));
        im.yPct = cmToPctY(snapCmToGrid(pctToCmY(im.yPct)));
      }

      const matches = applyAlignmentSnap(im, rect);
      renderAlignGuides(matches);

      applyTransform(im);
      if (selectedIds.has(im.id)) renderProps();
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      clearAlignGuides();
      scheduleSave();
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function startResize(e, imgState) {
    const rect = els.wallCanvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWPct = imgState.wPct;
    const startHPct = imgState.hPct;
    // Image's own aspect ratio (height/width), used to keep it locked while resizing.
    const naturalAspect =
      imgState.naturalW && imgState.naturalH ? imgState.naturalH / imgState.naturalW : startHPct / startWPct;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const newWPct = Math.max(2, startWPct + (dx / rect.width) * 100);
      let newHPct;
      // Shift key temporarily flips whichever mode the image is normally in.
      const freeform = imgState.aspectLocked ? ev.shiftKey : !ev.shiftKey;
      if (freeform) {
        // free-form stretch, ignoring the image's aspect ratio
        const dy = ev.clientY - startY;
        newHPct = Math.max(2, startHPct + (dy / rect.height) * 100);
      } else {
        const newWidthPx = (newWPct / 100) * rect.width;
        const newHeightPx = newWidthPx * naturalAspect;
        newHPct = Math.max(2, (newHeightPx / rect.height) * 100);
      }
      imgState.wPct = newWPct;
      imgState.hPct = newHPct;
      applyTransform(imgState);
      if (selectedIds.has(imgState.id)) renderProps();
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      scheduleSave();
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function startRotate(e, imgState) {
    const rec = elMap.get(imgState.id);

    function angleFor(ev) {
      const rect = rec.root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rad = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      return (rad * 180) / Math.PI + 90;
    }
    function onMove(ev) {
      let deg = angleFor(ev);
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      imgState.rotation = deg;
      applyTransform(imgState);
      if (selectedIds.has(imgState.id)) renderProps();
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      scheduleSave();
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function startNailDrag(e, nail, imgState) {
    // Convert screen-space drag delta directly into cm using the canvas's
    // uniform px-per-real-unit scale (same for both axes since the canvas
    // always keeps the wall's aspect ratio). Like the resize math elsewhere,
    // this ignores the image's rotation.
    const rect = els.wallCanvas.getBoundingClientRect();
    const scale = state.wall.width > 0 ? rect.width / state.wall.width : 0;
    const startX = e.clientX;
    const startY = e.clientY;
    const startXCm = nail.xCm;
    const startYCm = nail.yCm;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      nail.xCm = scale > 0 ? startXCm + dx / scale : startXCm;
      nail.yCm = scale > 0 ? startYCm + dy / scale : startYCm;
      applyTransform(imgState);
      if (selectedIds.has(imgState.id)) renderProps();
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      scheduleSave();
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  // ---------- measurement mode ----------
  function toggleMeasureMode() {
    measureModeActive = !measureModeActive;
    els.measureBtn.classList.toggle('active', measureModeActive);
    els.wallCanvas.classList.toggle('measuring', measureModeActive);
    selectImage(null); // avoid measurement clicks fighting with drag handles
  }

  // Click-drag between two arbitrary points on empty wall space, showing a
  // live distance readout in the wall's unit. Fully ephemeral — the line/
  // label elements are created and removed within this one gesture, nothing
  // is added to `state` or elMap. Reuses the same screen-px -> percent -> cm
  // conversion already used by startNailDrag/addImage above.
  function startMeasure(e) {
    const rect = els.wallCanvas.getBoundingClientRect();
    const line = document.createElement('div');
    line.className = 'measure-line';
    const label = document.createElement('div');
    label.className = 'measure-label';
    els.wallWarp.appendChild(line);
    els.wallWarp.appendChild(label);

    const x0 = e.clientX;
    const y0 = e.clientY;

    function update(ev) {
      const x0Pct = ((x0 - rect.left) / rect.width) * 100;
      const y0Pct = ((y0 - rect.top) / rect.height) * 100;
      const x1Pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const y1Pct = ((ev.clientY - rect.top) / rect.height) * 100;
      const dxCm = pctToCmX(x1Pct - x0Pct);
      const dyCm = pctToCmY(y1Pct - y0Pct);
      const distCm = Math.hypot(dxCm, dyCm);

      const x0Px = x0 - rect.left;
      const y0Px = y0 - rect.top;
      const x1Px = ev.clientX - rect.left;
      const y1Px = ev.clientY - rect.top;
      const lengthPx = Math.hypot(x1Px - x0Px, y1Px - y0Px);
      const angleDeg = (Math.atan2(y1Px - y0Px, x1Px - x0Px) * 180) / Math.PI;

      line.style.left = x0Px + 'px';
      line.style.top = y0Px + 'px';
      line.style.width = lengthPx + 'px';
      line.style.transform = `rotate(${angleDeg}deg)`;

      label.textContent = `${distCm.toFixed(1)} ${state.wall.unit}`;
      label.style.left = (x0Px + x1Px) / 2 + 'px';
      label.style.top = (y0Px + y1Px) / 2 + 'px';
    }
    function finish() {
      document.removeEventListener('pointermove', update);
      document.removeEventListener('pointerup', finish);
      line.remove();
      label.remove();
    }
    update(e);
    document.addEventListener('pointermove', update);
    document.addEventListener('pointerup', finish);
  }

  // ---------- layers list ----------
  function renderLayersList() {
    els.layersList.innerHTML = '';
    els.layersEmpty.style.display = state.images.length ? 'none' : 'block';
    // topmost layer shown first
    for (let i = state.images.length - 1; i >= 0; i--) {
      const im = state.images[i];
      const li = document.createElement('li');
      li.className = 'layer-item';
      li.dataset.id = String(im.id);
      if (selectedIds.has(im.id)) li.classList.add('selected');

      const thumb = document.createElement('img');
      thumb.src = im.src;
      li.appendChild(thumb);

      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = im.name;
      li.appendChild(name);

      const frontBtn = document.createElement('button');
      frontBtn.textContent = '⤒';
      frontBtn.title = 'Bring to front';
      frontBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bringToFront(im.id);
      });
      li.appendChild(frontBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.className = 'delete-btn';
      delBtn.title = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeImage(im.id);
      });
      li.appendChild(delBtn);

      li.addEventListener('click', (e) => {
        selectImage(im.id, { additive: e.shiftKey || e.ctrlKey || e.metaKey });
      });

      els.layersList.appendChild(li);
    }
  }

  // ---------- props panel ----------
  function renderProps() {
    if (selectedIds.size > 1) {
      els.propsPanel.innerHTML = `
        <p class="hint">${selectedIds.size} images selected.</p>
        <div class="prop-row"><button id="prop-bulk-front" type="button">Bring all to front</button></div>
        <div class="prop-row"><button id="prop-bulk-frame-toggle" type="button">Toggle frame</button></div>
        <div class="prop-row"><button id="prop-bulk-delete" type="button" class="danger-outline">Delete selected</button></div>
        <p class="hint">Drag any selected image to move the whole selection together. Resize/rotate act on a single image — click one alone first.</p>
      `;
      document.getElementById('prop-bulk-front').addEventListener('click', bulkBringToFront);
      document.getElementById('prop-bulk-frame-toggle').addEventListener('click', bulkToggleFrame);
      document.getElementById('prop-bulk-delete').addEventListener('click', bulkRemoveSelected);
      return;
    }
    const im = getSelected();
    if (!im) {
      els.propsPanel.innerHTML = '<p class="hint">Nothing selected.</p>';
      return;
    }
    const unit = state.wall.unit;
    const xVal = pctToCmX(im.xPct);
    const yVal = pctToCmY(im.yPct);
    const wVal = pctToCmX(im.wPct);
    const hVal = pctToCmY(im.hPct);

    const frame = im.frame || { enabled: false, color: 'black', width: 3 };
    const frameColorLabels = {
      'light-wood': 'Light wood',
      'dark-wood': 'Dark wood',
      black: 'Black',
      white: 'White',
    };

    els.propsPanel.innerHTML = `
      <div class="prop-grid">
        <div class="prop-row"><label>X (${unit})</label><input type="number" step="0.5" id="prop-x" value="${xVal.toFixed(1)}"></div>
        <div class="prop-row"><label>Y (${unit})</label><input type="number" step="0.5" id="prop-y" value="${yVal.toFixed(1)}"></div>
        <div class="prop-row"><label>Width (${unit})</label><input type="number" step="0.5" min="0.1" id="prop-w" value="${wVal.toFixed(1)}"></div>
        <div class="prop-row"><label>Height (${unit})</label><input type="number" step="0.5" min="0.1" id="prop-h" value="${hVal.toFixed(1)}"></div>
        <div class="prop-row span-2"><label>Rotation °</label><input type="number" step="1" id="prop-r" value="${Math.round(im.rotation)}"></div>
      </div>
      <div class="prop-row"><label>Lock aspect ratio</label><input type="checkbox" id="prop-aspect-locked" ${im.aspectLocked ? 'checked' : ''}></div>
      <div class="prop-row"><label>Crop to fit</label><input type="checkbox" id="prop-crop" ${im.crop ? 'checked' : ''}></div>
      <p class="hint">${
        im.aspectLocked
          ? "Width/height stay proportional to keep the image's aspect ratio (drag handle: hold Shift to stretch freely)."
          : "Width/height can be changed independently (drag handle: hold Shift to keep the aspect ratio)."
      }</p>
      <div class="prop-row"><label>Snap to grid</label><input type="checkbox" id="prop-snap-grid" ${im.snapToGrid ? 'checked' : ''}></div>
      <p class="hint">While dragging, position snaps to the nearest ${state.grid.size}${unit} grid line (Settings → Reference grid controls the grid size).</p>
      <div class="prop-row"><label>Frame</label><input type="checkbox" id="prop-frame-enabled" ${frame.enabled ? 'checked' : ''}></div>
      ${
        frame.enabled
          ? `
      <div class="prop-row"><label>Frame color</label>
        <select id="prop-frame-color">
          ${FRAME_COLORS.map((c) => `<option value="${c}" ${frame.color === c ? 'selected' : ''}>${frameColorLabels[c]}</option>`).join('')}
        </select>
      </div>
      <div class="prop-row"><label>Frame width (${unit})</label><input type="number" step="0.5" min="0.5" id="prop-frame-width" value="${frame.width}"></div>
      <p class="hint">Width/height above are the photo itself — the frame adds on top, so the total footprint on the wall is bigger by the frame width on each side.</p>
      `
          : ''
      }
      <div class="prop-row"><label>Nails</label><button id="prop-nail-add" type="button">+ Add nail</button></div>
      <div id="prop-nails-list"></div>
      <p class="hint">Hanging-point dot position(s), in ${unit} from the photo's own top-left corner. Drag a dot on the wall instead if that's easier.</p>
    `;

    // Image's own aspect ratio (height/width) — used to keep width/height edits proportional.
    const aspect = im.naturalW && im.naturalH ? im.naturalH / im.naturalW : im.hPct / im.wPct;

    document.getElementById('prop-x').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isNaN(v)) return;
      im.xPct = cmToPctX(v);
      applyTransform(im);
      scheduleSave();
    });
    document.getElementById('prop-y').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isNaN(v)) return;
      im.yPct = cmToPctY(v);
      applyTransform(im);
      scheduleSave();
    });
    document.getElementById('prop-w').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isNaN(v) || v <= 0) return;
      im.wPct = cmToPctX(v);
      if (im.aspectLocked) {
        im.hPct = cmToPctY(v * aspect);
        document.getElementById('prop-h').value = (v * aspect).toFixed(1);
      }
      applyTransform(im);
      scheduleSave();
    });
    document.getElementById('prop-h').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isNaN(v) || v <= 0) return;
      im.hPct = cmToPctY(v);
      if (im.aspectLocked) {
        im.wPct = cmToPctX(v / aspect);
        document.getElementById('prop-w').value = (v / aspect).toFixed(1);
      }
      applyTransform(im);
      scheduleSave();
    });
    document.getElementById('prop-aspect-locked').addEventListener('change', (e) => {
      im.aspectLocked = e.target.checked;
      renderProps();
      scheduleSave();
    });
    document.getElementById('prop-crop').addEventListener('change', (e) => {
      im.crop = e.target.checked;
      applyTransform(im);
      scheduleSave();
    });
    document.getElementById('prop-snap-grid').addEventListener('change', (e) => {
      im.snapToGrid = e.target.checked;
      scheduleSave();
    });
    document.getElementById('prop-r').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isNaN(v)) return;
      im.rotation = v;
      applyTransform(im);
      scheduleSave();
    });

    document.getElementById('prop-frame-enabled').addEventListener('change', (e) => {
      im.frame.enabled = e.target.checked;
      applyTransform(im);
      renderProps();
      scheduleSave();
    });
    const frameColorEl = document.getElementById('prop-frame-color');
    if (frameColorEl) {
      frameColorEl.addEventListener('change', (e) => {
        im.frame.color = e.target.value;
        applyTransform(im);
        scheduleSave();
      });
    }
    const frameWidthEl = document.getElementById('prop-frame-width');
    if (frameWidthEl) {
      frameWidthEl.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        if (Number.isNaN(v) || v < 0) return;
        im.frame.width = v;
        applyTransform(im);
        scheduleSave();
      });
    }

    renderNailListUI(im);
    document.getElementById('prop-nail-add').addEventListener('click', () => {
      const wReal = pctToCmX(im.wPct);
      const hReal = pctToCmY(im.hPct);
      im.nails.push({ xCm: wReal / 2, yCm: hReal / 2 });
      renderNailDots(im);
      renderNailListUI(im);
      scheduleSave();
    });
  }

  // Builds the per-image nail rows (X/Y cm + delete) inside the props panel.
  // Kept separate from renderProps' innerHTML template, like the layers
  // list, so each row's handlers close directly over its own nail object —
  // no id/index bookkeeping needed to find "the right one" later.
  function renderNailListUI(im) {
    const unit = state.wall.unit;
    const container = document.getElementById('prop-nails-list');
    if (!container) return;
    container.innerHTML = '';
    im.nails.forEach((nail, i) => {
      const row = document.createElement('div');
      row.className = 'nail-row';

      const xInput = document.createElement('input');
      xInput.type = 'number';
      xInput.step = '0.5';
      xInput.title = `X (${unit})`;
      xInput.value = nail.xCm.toFixed(1);
      xInput.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        if (Number.isNaN(v)) return;
        nail.xCm = v;
        applyTransform(im);
        scheduleSave();
      });

      const yInput = document.createElement('input');
      yInput.type = 'number';
      yInput.step = '0.5';
      yInput.title = `Y (${unit})`;
      yInput.value = nail.yCm.toFixed(1);
      yInput.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        if (Number.isNaN(v)) return;
        nail.yCm = v;
        applyTransform(im);
        scheduleSave();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'delete-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove nail';
      delBtn.addEventListener('click', () => {
        im.nails.splice(i, 1);
        renderNailDots(im);
        renderNailListUI(im);
        scheduleSave();
      });

      row.appendChild(xInput);
      row.appendChild(yInput);
      row.appendChild(delBtn);
      container.appendChild(row);
    });
  }

  // ---------- calibration ruler ----------
  // Two identical rulers (top and bottom) sharing the same length/visibility
  // settings: comparing their on-wall lengths is how you spot projector
  // keystone/distortion (they should measure the same on the physical wall).
  let rulerEls = [];

  function createRulerElement(position) {
    const rulerEl = document.createElement('div');
    rulerEl.className = `calibration-ruler ruler-${position}`;
    const rulerLabelEl = document.createElement('span');
    rulerLabelEl.className = 'ruler-label';
    rulerEl.appendChild(rulerLabelEl);
    els.wallWarp.appendChild(rulerEl);
    rulerEls.push({ rulerEl, rulerLabelEl });
  }

  function renderRuler() {
    if (!rulerEls.length) return;
    const widthPct = cmToPctX(state.ruler.length);
    const label = `${state.ruler.length} ${state.wall.unit}`;
    rulerEls.forEach(({ rulerEl, rulerLabelEl }) => {
      rulerEl.style.width = widthPct + '%';
      rulerEl.style.display = state.ruler.visible ? 'block' : 'none';
      rulerLabelEl.textContent = label;
    });
    els.rulerUnitLabel.textContent = state.wall.unit;
    els.wallCanvas.style.setProperty('--ruler-color', state.ruler.color);
  }

  // ---------- reference grid (editor only) ----------
  let gridEl = null;

  function createGridElement() {
    gridEl = document.createElement('div');
    gridEl.id = 'reference-grid';
    els.wallWarp.appendChild(gridEl);
  }

  // A tiled SVG (dashed line along each cell's top+left edge) reads as a
  // dotted grid of LINES rather than isolated dots at the intersections.
  function buildGridTile(cellPx) {
    const c = Math.max(4, Math.round(cellPx));
    const color = 'rgba(255,255,255,0.4)';
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${c}' height='${c}'>` +
      `<line x1='0' y1='0.5' x2='${c}' y2='0.5' stroke='${color}' stroke-dasharray='1,3'/>` +
      `<line x1='0.5' y1='0' x2='0.5' y2='${c}' stroke='${color}' stroke-dasharray='1,3'/>` +
      `</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  // Cell size is a real-world measurement, so it's computed in pixels from
  // the canvas's current on-screen size rather than as a CSS percentage —
  // this needs to be re-run whenever the canvas itself is resized (see
  // fitCanvas), same as the frame-thickness math.
  function renderGrid() {
    if (!gridEl) return;
    els.gridSizeUnit.textContent = state.wall.unit;
    const presenting = document.body.classList.contains('presenting');
    const visible = state.grid.enabled && (!presenting || state.grid.projectToo);
    gridEl.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    const rect = els.wallCanvas.getBoundingClientRect();
    const scale = state.wall.width > 0 ? rect.width / state.wall.width : 0;
    const cellPx = Math.max(2, state.grid.size * scale);
    gridEl.style.backgroundImage = buildGridTile(cellPx);
    gridEl.style.backgroundSize = `${cellPx}px ${cellPx}px`;
  }

  // ---------- alignment guides (editor only, shown while dragging) ----------
  let alignGuidesEl = null;

  function createAlignGuidesElement() {
    alignGuidesEl = document.createElement('div');
    alignGuidesEl.id = 'align-guides';
    els.wallWarp.appendChild(alignGuidesEl);
  }

  // Bounding-box edges of an image in px relative to the canvas, ignoring
  // rotation — same screen-space simplification the drag/resize handlers
  // already use throughout.
  function getImageEdgesPx(imgState, rect) {
    const left = (imgState.xPct / 100) * rect.width;
    const top = (imgState.yPct / 100) * rect.height;
    const width = (imgState.wPct / 100) * rect.width;
    const height = (imgState.hPct / 100) * rect.height;
    return {
      left,
      right: left + width,
      centerX: left + width / 2,
      top,
      bottom: top + height,
      centerY: top + height / 2,
    };
  }

  const ALIGN_SNAP_PX = 6;

  // Compares the dragged image's edges/center against every other image's,
  // snapping xPct/yPct to the closest match on each axis (independently) and
  // returning the matched px coordinates to draw guide lines at. Mutates
  // imgState only if a match is found on that axis.
  function applyAlignmentSnap(imgState, rect) {
    const dragged = getImageEdgesPx(imgState, rect);
    let bestX = null; // {distance, guidePx, deltaPx}
    let bestY = null;
    state.images.forEach((other) => {
      if (other.id === imgState.id) return;
      const o = getImageEdgesPx(other, rect);
      [
        [dragged.left, o.left],
        [dragged.left, o.right],
        [dragged.right, o.left],
        [dragged.right, o.right],
        [dragged.centerX, o.centerX],
      ].forEach(([draggedPx, otherPx]) => {
        const distance = Math.abs(draggedPx - otherPx);
        if (distance <= ALIGN_SNAP_PX && (!bestX || distance < bestX.distance)) {
          bestX = { distance, guidePx: otherPx, deltaPx: otherPx - draggedPx };
        }
      });
      [
        [dragged.top, o.top],
        [dragged.top, o.bottom],
        [dragged.bottom, o.top],
        [dragged.bottom, o.bottom],
        [dragged.centerY, o.centerY],
      ].forEach(([draggedPx, otherPx]) => {
        const distance = Math.abs(draggedPx - otherPx);
        if (distance <= ALIGN_SNAP_PX && (!bestY || distance < bestY.distance)) {
          bestY = { distance, guidePx: otherPx, deltaPx: otherPx - draggedPx };
        }
      });
    });
    if (bestX) imgState.xPct += (bestX.deltaPx / rect.width) * 100;
    if (bestY) imgState.yPct += (bestY.deltaPx / rect.height) * 100;
    return {
      x: bestX ? bestX.guidePx : null,
      y: bestY ? bestY.guidePx : null,
    };
  }

  function renderAlignGuides(matches) {
    if (!alignGuidesEl) return;
    alignGuidesEl.innerHTML = '';
    if (matches.x !== null) {
      const line = document.createElement('div');
      line.className = 'align-guide align-guide-v';
      line.style.left = matches.x + 'px';
      alignGuidesEl.appendChild(line);
    }
    if (matches.y !== null) {
      const line = document.createElement('div');
      line.className = 'align-guide align-guide-h';
      line.style.top = matches.y + 'px';
      alignGuidesEl.appendChild(line);
    }
  }

  function clearAlignGuides() {
    if (alignGuidesEl) alignGuidesEl.innerHTML = '';
  }

  // ---------- hanging-point dots ----------
  // Color/size are global, applied via CSS custom properties on #wall-canvas
  // so every .nail-dot picks them up automatically without touching each
  // image. Visibility is a class toggle for the same reason.
  function applyNailGlobalStyle() {
    els.wallCanvas.style.setProperty('--nail-color', state.nail.color);
    els.wallCanvas.style.setProperty('--nail-size', state.nail.size + 'px');
    els.wallCanvas.classList.toggle('nails-hidden', !state.nail.enabled);
  }

  // ---------- background ----------
  // The wall background color is mainly an editor convenience (e.g. to
  // preview a paint color). By default a real projector shouldn't cast
  // color where there's no image, so fullscreen/present mode forces it
  // back to black — unless "Also show when projecting" is turned on.
  function applyCanvasBackground() {
    const presenting = document.body.classList.contains('presenting');
    const showColor = state.background.enabled && (!presenting || state.background.projectToo);
    if (showColor) {
      els.wallCanvas.style.backgroundColor = state.background.color;
      els.wallCanvas.style.backgroundImage = 'none';
    } else if (presenting) {
      els.wallCanvas.style.backgroundColor = '#000';
      els.wallCanvas.style.backgroundImage = 'none';
    } else {
      els.wallCanvas.style.backgroundColor = '';
      els.wallCanvas.style.backgroundImage = '';
    }
  }

  // ---------- settings & help modals ----------
  let settingsSection = 'appearance-section';
  function setSettingsSection(sectionId) {
    settingsSection = sectionId;
    els.settingsNavItems.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
    document.querySelectorAll('#settings-modal .modal-body section').forEach((sec) => {
      sec.classList.toggle('active-section', sec.id === sectionId);
    });
    const activeNavItem = document.querySelector(`.settings-nav-item[data-section="${sectionId}"]`);
    els.settingsTitle.textContent = activeNavItem ? activeNavItem.textContent : '';
  }
  function openSettings(sectionId) {
    setSettingsSection(sectionId || settingsSection);
    els.settingsModal.classList.remove('hidden');
  }
  function closeSettings() {
    els.settingsModal.classList.add('hidden');
  }
  function openHelp() {
    els.helpModal.classList.remove('hidden');
  }
  function closeHelp() {
    els.helpModal.classList.add('hidden');
  }

  els.settingsNavItems.forEach((btn) => {
    btn.addEventListener('click', () => setSettingsSection(btn.dataset.section));
  });

  els.settingsBtn.addEventListener('click', () => openSettings());
  els.settingsClose.addEventListener('click', closeSettings);
  els.settingsModal.addEventListener('pointerdown', (e) => {
    if (e.target === els.settingsModal) closeSettings();
  });

  els.helpBtn.addEventListener('click', openHelp);
  els.helpClose.addEventListener('click', closeHelp);
  els.helpModal.addEventListener('pointerdown', (e) => {
    if (e.target === els.helpModal) closeHelp();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.settingsModal.classList.contains('hidden')) closeSettings();
    if (!els.helpModal.classList.contains('hidden')) closeHelp();
  });

  // ---------- present mode ----------
  function togglePresent() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      selectImage(null);
      closeSettings();
      closeHelp();
      els.wallFrame.requestFullscreen().catch((err) => {
        console.warn('Fullscreen failed', err);
      });
    }
  }

  document.addEventListener('fullscreenchange', () => {
    const active = !!document.fullscreenElement;
    document.body.classList.toggle('presenting', active);
    document.getElementById('present-btn-label').textContent = active ? 'Exit' : 'Project';
    applyCanvasBackground();
    // give the browser a frame to settle the new layout before measuring it
    requestAnimationFrame(fitCanvas);
  });

  new ResizeObserver(fitCanvas).observe(els.wallFrame);
  window.addEventListener('resize', fitCanvas);

  // The sidebar floats over the canvas rather than pushing it aside, so it
  // needs to know the topbar's actual rendered height (which can grow if the
  // wall-size fields wrap on a narrow window) to sit just below it.
  function positionSidebar() {
    els.sidebar.style.top = els.topbar.getBoundingClientRect().height + 'px';
  }
  new ResizeObserver(positionSidebar).observe(els.topbar);
  positionSidebar();

  els.sidebarCollapseBtn.addEventListener('click', () => {
    setSidebarCollapsed(!uiPrefs.sidebarCollapsed);
  });
  els.layersCompactToggle.addEventListener('click', () => {
    setLayersCompact(!uiPrefs.layersCompact);
  });
  els.workspaceAddBtn.addEventListener('click', createWorkspace);

  els.themePicker.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-theme-choice]');
    if (!btn) return;
    setSegmentedValue(els.themePicker, 'themeChoice', btn.dataset.themeChoice);
    setTheme(btn.dataset.themeChoice);
  });
  els.themeToggleBtn.addEventListener('click', () => {
    setTheme(resolveEffectiveTheme() === 'dark' ? 'light' : 'dark');
    setSegmentedValue(els.themePicker, 'themeChoice', uiPrefs.theme);
  });
  if (systemThemeQuery) {
    systemThemeQuery.addEventListener('change', () => {
      if (uiPrefs.theme === 'system') applyTheme();
    });
  }

  // ---------- events ----------
  els.applySize.addEventListener('click', applyWallSize);
  els.presentBtn.addEventListener('click', togglePresent);
  els.measureBtn.addEventListener('click', toggleMeasureMode);
  els.clearAll.addEventListener('click', clearAll);

  els.fileInput.addEventListener('change', (e) => {
    Array.from(e.target.files || []).forEach(addImageFromFile);
    e.target.value = '';
  });

  els.urlAdd.addEventListener('click', () => {
    const url = els.urlInput.value.trim();
    if (url) {
      addImageFromUrl(url);
      els.urlInput.value = '';
    }
  });
  els.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.urlAdd.click();
  });

  els.rulerLength.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isNaN(v) || v <= 0) return;
    state.ruler.length = v;
    renderRuler();
    scheduleSave();
  });
  els.rulerColor.addEventListener('input', (e) => {
    state.ruler.color = e.target.value;
    renderRuler();
    scheduleSave();
  });

  els.rulerVisible.addEventListener('change', (e) => {
    state.ruler.visible = e.target.checked;
    renderRuler();
    scheduleSave();
  });

  els.bgEnabled.addEventListener('change', (e) => {
    state.background.enabled = e.target.checked;
    applyCanvasBackground();
    scheduleSave();
  });
  els.bgColor.addEventListener('input', (e) => {
    state.background.color = e.target.value;
    applyCanvasBackground();
    scheduleSave();
  });
  els.bgProject.addEventListener('change', (e) => {
    state.background.projectToo = e.target.checked;
    applyCanvasBackground();
    scheduleSave();
  });

  els.defaultWidth.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isNaN(v) || v <= 0) return;
    state.defaults.imageWidth = v;
    scheduleSave();
  });
  els.defaultFrameEnabled.addEventListener('change', (e) => {
    state.defaults.frameEnabled = e.target.checked;
    scheduleSave();
  });
  els.defaultFrameColor.addEventListener('change', (e) => {
    state.defaults.frameColor = e.target.value;
    scheduleSave();
  });
  els.defaultFrameWidth.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isNaN(v) || v < 0) return;
    state.defaults.frameWidth = v;
    scheduleSave();
  });

  els.gridEnabled.addEventListener('change', (e) => {
    state.grid.enabled = e.target.checked;
    renderGrid();
    scheduleSave();
  });
  els.gridSize.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isNaN(v) || v <= 0) return;
    state.grid.size = v;
    renderGrid();
    scheduleSave();
  });
  els.gridProject.addEventListener('change', (e) => {
    state.grid.projectToo = e.target.checked;
    renderGrid();
    scheduleSave();
  });

  els.nailEnabled.addEventListener('change', (e) => {
    state.nail.enabled = e.target.checked;
    applyNailGlobalStyle();
    scheduleSave();
  });
  els.nailColor.addEventListener('input', (e) => {
    state.nail.color = e.target.value;
    applyNailGlobalStyle();
    scheduleSave();
  });
  els.nailSize.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isNaN(v) || v <= 0) return;
    state.nail.size = v;
    applyNailGlobalStyle();
    scheduleSave();
  });

  els.keystoneEnabled.addEventListener('change', (e) => {
    state.keystone.enabled = e.target.checked;
    applyKeystone();
    scheduleSave();
  });
  els.keystoneVertical.addEventListener('input', (e) => {
    state.keystone.vertical = parseFloat(e.target.value) || 0;
    applyKeystone();
    scheduleSave();
  });
  els.keystoneHorizontal.addEventListener('input', (e) => {
    state.keystone.horizontal = parseFloat(e.target.value) || 0;
    applyKeystone();
    scheduleSave();
  });

  els.wallCanvas.addEventListener('pointerdown', (e) => {
    if (e.target !== els.wallCanvas && e.target !== els.wallWarp) return;
    if (measureModeActive) {
      startMeasure(e);
      return;
    }
    selectImage(null);
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod) {
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
        return;
      }
    }
    if (!selectedIds.size) return;
    const targets = state.images.filter((im) => selectedIds.has(im.id));
    if (!targets.length) return;
    const step = e.shiftKey ? 2 : 0.5;
    let handled = true;
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        bulkRemoveSelected();
        break;
      case 'ArrowLeft':
        targets.forEach((im) => (im.xPct -= step));
        break;
      case 'ArrowRight':
        targets.forEach((im) => (im.xPct += step));
        break;
      case 'ArrowUp':
        targets.forEach((im) => (im.yPct -= step));
        break;
      case 'ArrowDown':
        targets.forEach((im) => (im.yPct += step));
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      if (e.key !== 'Delete' && e.key !== 'Backspace') {
        targets.forEach(applyTransform);
        renderProps();
        scheduleSave();
      }
    }
  });

  // ---------- hydrate / teardown (shared by boot and file import) ----------
  function hydrateFromState() {
    els.wallWidth.value = state.wall.width;
    els.wallHeight.value = state.wall.height;
    setWallUnit(state.wall.unit);
    fitCanvas();

    createGridElement();
    els.gridEnabled.checked = state.grid.enabled;
    els.gridSize.value = state.grid.size;
    els.gridProject.checked = state.grid.projectToo;
    renderGrid();

    createAlignGuidesElement();

    createRulerElement('top');
    createRulerElement('bottom');
    els.rulerLength.value = state.ruler.length;
    els.rulerVisible.checked = state.ruler.visible;
    els.rulerColor.value = state.ruler.color;
    renderRuler();

    els.bgEnabled.checked = state.background.enabled;
    els.bgColor.value = state.background.color;
    els.bgProject.checked = state.background.projectToo;
    applyCanvasBackground();

    els.defaultWidth.value = state.defaults.imageWidth;
    els.defaultFrameEnabled.checked = state.defaults.frameEnabled;
    els.defaultFrameColor.value = state.defaults.frameColor;
    els.defaultFrameWidth.value = state.defaults.frameWidth;
    renderDefaultsUnitLabels();

    els.nailEnabled.checked = state.nail.enabled;
    els.nailColor.value = state.nail.color;
    els.nailSize.value = state.nail.size;
    applyNailGlobalStyle();

    els.keystoneEnabled.checked = state.keystone.enabled;
    els.keystoneVertical.value = state.keystone.vertical;
    els.keystoneHorizontal.value = state.keystone.horizontal;
    applyKeystone();

    state.images.forEach(renderImage);
    reindexZ();
    renderLayersList();
    renderProps();
  }

  // Removes everything hydrateFromState() creates, so importing a file
  // doesn't just add to what's already there or leave orphaned elements.
  function teardownDOM() {
    elMap.forEach((rec) => rec.root.remove());
    elMap.clear();
    if (gridEl) {
      gridEl.remove();
      gridEl = null;
    }
    if (alignGuidesEl) {
      alignGuidesEl.remove();
      alignGuidesEl = null;
    }
    rulerEls.forEach(({ rulerEl }) => rulerEl.remove());
    rulerEls = [];
    selectedIds.clear();
  }

  // ---------- export / import ----------
  function downloadJSON(obj, filename) {
    const json = JSON.stringify(obj, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function sanitizeFilenamePart(name) {
    return (name || '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'wall';
  }

  // Returns `baseName`, or `baseName (2)`, `baseName (3)`, ... if it already
  // collides with a current workspace — shared by both the single-workspace
  // and bundle import paths so imported tabs never silently overwrite a name.
  function dedupeWorkspaceName(baseName) {
    let name = baseName;
    let n = 2;
    while (workspaces.some((w) => w.name === name)) {
      name = `${baseName} (${n++})`;
    }
    return name;
  }

  function exportCurrentWorkspace() {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJSON(state, `wall-projector-${sanitizeFilenamePart(ws && ws.name)}-${stamp}.json`);
  }

  function exportAllWorkspaces() {
    // Flush the active workspace's pending debounced save first, so the
    // on-disk copy read below (via readWorkspaceState) is current.
    clearTimeout(saveTimer);
    saveState();
    const bundle = {
      type: 'wall-projector-workspaces',
      workspaces: workspaces.map((ws) => ({
        name: ws.name,
        state: readWorkspaceState(ws.id) || makeDefaultState(),
      })),
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJSON(bundle, `wall-projector-all-${stamp}.json`);
  }

  // Makes the given (already-created) workspace the active one and refreshes
  // the whole UI — shared by both import paths below.
  function activateImportedWorkspace(id) {
    clearTimeout(saveTimer);
    saveState();
    activeWorkspaceId = id;
    teardownDOM();
    activateWorkspaceState(id);
    hydrateFromState();
    resetUndoHistory();
    renderWorkspaceTabs();
    saveWorkspaceIndex();
  }

  function addImportedWorkspace(name, wsState) {
    const dedupedName = dedupeWorkspaceName(name);
    const id = 'ws-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try {
      localStorage.setItem(workspaceStateKey(id), JSON.stringify(wsState));
    } catch (err) {
      console.warn('Could not save imported workspace', err);
    }
    workspaces.push({ id, name: dedupedName });
    return id;
  }

  function importProjectFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        alert("That doesn't look like a Wall Projector project file.");
        return;
      }

      if (parsed && parsed.type === 'wall-projector-workspaces' && Array.isArray(parsed.workspaces)) {
        // A bundle exported via "Export all workspaces" — adds one new tab
        // per workspace inside it, and switches to the first one imported.
        if (!parsed.workspaces.length) {
          alert('That file has no workspaces in it.');
          return;
        }
        let normalized;
        try {
          normalized = parsed.workspaces.map((entry) => ({
            name: entry.name || 'Imported',
            state: normalizeState(entry.state),
          }));
        } catch (err) {
          alert("That doesn't look like a Wall Projector workspaces file.");
          return;
        }
        let firstId = null;
        normalized.forEach(({ name, state: wsState }) => {
          const id = addImportedWorkspace(name, wsState);
          if (firstId === null) firstId = id;
        });
        activateImportedWorkspace(firstId);
        closeSettings();
        return;
      }

      let next;
      try {
        next = normalizeState(parsed);
      } catch (err) {
        alert("That doesn't look like a Wall Projector project file.");
        return;
      }
      const id = addImportedWorkspace(file.name.replace(/\.json$/i, '') || 'Imported', next);
      activateImportedWorkspace(id);
      closeSettings();
    };
    reader.onerror = () => alert('Could not read that file.');
    reader.readAsText(file);
  }

  els.exportBtn.addEventListener('click', exportCurrentWorkspace);
  els.exportAllBtn.addEventListener('click', exportAllWorkspaces);
  els.importBtn.addEventListener('click', () => els.importFileInput.click());
  els.importFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importProjectFromFile(file);
    e.target.value = '';
  });

  // ---------- init ----------
  function init() {
    // Placeholder is only substituted by the Docker build (see Dockerfile) —
    // running straight from source shows "dev" instead of a raw token. This
    // checks the generic __xxx__ shape rather than comparing against the
    // literal placeholder text, since the Dockerfile's sed replaces the
    // first match on every line — a literal comparison here would itself
    // get substituted and always be true, permanently showing "dev".
    const isUnbaked = /^__.+__$/.test(APP_VERSION);
    els.appVersion.textContent = isUnbaked ? 'dev' : `v${APP_VERSION}`;

    loadUIPrefs();
    setSidebarCollapsed(uiPrefs.sidebarCollapsed);
    setLayersCompact(uiPrefs.layersCompact);
    setSegmentedValue(els.themePicker, 'themeChoice', uiPrefs.theme);
    applyTheme();
    setSettingsSection('appearance-section');
    loadWorkspaces();
    activateWorkspaceState(activeWorkspaceId);
    renderWorkspaceTabs();
    hydrateFromState();
    resetUndoHistory();
  }

  init();
})();
