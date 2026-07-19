import type { ImageState, Nail } from '../types';
import { cmToPctX, cmToPctY, computeAlignmentSnap, pctToCmX, pctToCmY, snapCmToGrid } from '../geometry';
import type { ProjectCore } from './useProjectCore';

export interface AlignGuides {
  x: number | null;
  y: number | null;
}

/**
 * Pointer-based interaction handlers: 1:1 port of app.js's startDrag/
 * startResize/startRotate/startNailDrag. Deliberately keeps every
 * simplification from the original — screen-space deltas that ignore the
 * image's own rotation, a bounding rect captured once at gesture start (not
 * re-measured per move), document-level pointermove/pointerup listeners
 * added/removed per gesture. Do not "fix" the rotation-ignoring behavior;
 * it's intentional and consistent throughout the app.
 *
 * Unlike app.js (which mutates a plain object + the DOM directly, then
 * debounce-saves), here every move calls back into React state via
 * `project.updateImage`/`translateImages`. The save/undo-snapshot debounce
 * effect in useProject() fires the same way on every resulting state change,
 * so no separate "on gesture end, save" call is needed.
 */
export function startDrag(
  e: React.PointerEvent,
  imgState: ImageState,
  wallCanvasEl: HTMLElement,
  project: ProjectCore,
  setAlignGuides: (g: AlignGuides) => void,
) {
  const rect = wallCanvasEl.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;
  const groupDrag = project.selectedIds.has(imgState.id) && project.selectedIds.size > 1;
  const targets = groupDrag ? project.state.images.filter((im) => project.selectedIds.has(im.id)) : [imgState];
  const starts = targets.map((im) => ({ id: im.id, xPct: im.xPct, yPct: im.yPct }));
  const otherImages = project.state.images.filter((im) => im.id !== imgState.id);

  function onMove(ev: PointerEvent) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const dxPct = (dx / rect.width) * 100;
    const dyPct = (dy / rect.height) * 100;

    if (starts.length > 1) {
      // Group drag: pure rigid translation, no per-image snapping (snapping
      // would apply a different correction to each image and break the
      // group's relative layout).
      starts.forEach(({ id, xPct, yPct }) => {
        project.updateImage(id, { xPct: xPct + dxPct, yPct: yPct + dyPct });
      });
      return;
    }

    const { id, xPct, yPct } = starts[0];
    let newXPct = xPct + dxPct;
    let newYPct = yPct + dyPct;

    if (imgState.snapToGrid) {
      newXPct = cmToPctX(snapCmToGrid(pctToCmX(newXPct, project.state.wall.width), project.state.grid.size), project.state.wall.width);
      newYPct = cmToPctY(snapCmToGrid(pctToCmY(newYPct, project.state.wall.height), project.state.grid.size), project.state.wall.height);
    }

    const dragged = { id, xPct: newXPct, yPct: newYPct, wPct: imgState.wPct, hPct: imgState.hPct };
    const snap = computeAlignmentSnap(dragged, otherImages, rect);
    if (snap.xPct !== undefined) newXPct = snap.xPct;
    if (snap.yPct !== undefined) newYPct = snap.yPct;
    setAlignGuides({ x: snap.guideX, y: snap.guideY });

    project.updateImage(id, { xPct: newXPct, yPct: newYPct });
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    setAlignGuides({ x: null, y: null });
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

export function startResize(e: React.PointerEvent, imgState: ImageState, wallCanvasEl: HTMLElement, project: ProjectCore) {
  const rect = wallCanvasEl.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;
  const startWPct = imgState.wPct;
  const startHPct = imgState.hPct;
  const naturalAspect = imgState.naturalW && imgState.naturalH ? imgState.naturalH / imgState.naturalW : startHPct / startWPct;

  function onMove(ev: PointerEvent) {
    const dx = ev.clientX - startX;
    const newWPct = Math.max(2, startWPct + (dx / rect.width) * 100);
    let newHPct: number;
    // Shift key temporarily flips whichever mode the image is normally in.
    const freeform = imgState.aspectLocked ? ev.shiftKey : !ev.shiftKey;
    if (freeform) {
      const dy = ev.clientY - startY;
      newHPct = Math.max(2, startHPct + (dy / rect.height) * 100);
    } else {
      const newWidthPx = (newWPct / 100) * rect.width;
      const newHeightPx = newWidthPx * naturalAspect;
      newHPct = Math.max(2, (newHeightPx / rect.height) * 100);
    }
    project.updateImage(imgState.id, { wPct: newWPct, hPct: newHPct });
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

export function startRotate(e: React.PointerEvent, imgState: ImageState, imageRootEl: HTMLElement, project: ProjectCore) {
  function angleFor(ev: PointerEvent) {
    const rect = imageRootEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rad = Math.atan2(ev.clientY - cy, ev.clientX - cx);
    return (rad * 180) / Math.PI + 90;
  }
  function onMove(ev: PointerEvent) {
    let deg = angleFor(ev);
    if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
    project.updateImage(imgState.id, { rotation: deg });
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

export function startNailDrag(
  e: React.PointerEvent,
  nailIndex: number,
  imgState: ImageState,
  wallCanvasEl: HTMLElement,
  project: ProjectCore,
) {
  // Convert screen-space drag delta directly into cm using the canvas's
  // uniform px-per-real-unit scale (same for both axes since the canvas
  // always keeps the wall's aspect ratio). Like resize, ignores rotation.
  const rect = wallCanvasEl.getBoundingClientRect();
  const wallWidth = project.state.wall.width;
  const scale = wallWidth > 0 ? rect.width / wallWidth : 0;
  const startX = e.clientX;
  const startY = e.clientY;
  const nail = imgState.nails[nailIndex];
  const startXCm = nail.xCm;
  const startYCm = nail.yCm;

  function onMove(ev: PointerEvent) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const patch: Partial<Nail> = {
      xCm: scale > 0 ? startXCm + dx / scale : startXCm,
      yCm: scale > 0 ? startYCm + dy / scale : startYCm,
    };
    project.updateNail(imgState.id, nailIndex, patch);
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

export interface MeasureLine {
  x0Px: number;
  y0Px: number;
  lengthPx: number;
  angleDeg: number;
  midXPx: number;
  midYPx: number;
  label: string;
}

// Click-drag between two arbitrary points on empty wall space, showing a live
// distance readout. Fully ephemeral (never touches project state) — caller
// supplies a setter for the transient line/label to render.
export function startMeasure(
  e: React.PointerEvent,
  wallCanvasEl: HTMLElement,
  wall: { width: number; height: number; unit: string },
  setMeasureLine: (line: MeasureLine | null) => void,
) {
  const rect = wallCanvasEl.getBoundingClientRect();
  const x0 = e.clientX;
  const y0 = e.clientY;

  function update(ev: PointerEvent | React.PointerEvent) {
    const x0Pct = ((x0 - rect.left) / rect.width) * 100;
    const y0Pct = ((y0 - rect.top) / rect.height) * 100;
    const x1Pct = ((ev.clientX - rect.left) / rect.width) * 100;
    const y1Pct = ((ev.clientY - rect.top) / rect.height) * 100;
    const dxCm = pctToCmX(x1Pct - x0Pct, wall.width);
    const dyCm = pctToCmY(y1Pct - y0Pct, wall.height);
    const distCm = Math.hypot(dxCm, dyCm);

    const x0Px = x0 - rect.left;
    const y0Px = y0 - rect.top;
    const x1Px = ev.clientX - rect.left;
    const y1Px = ev.clientY - rect.top;
    const lengthPx = Math.hypot(x1Px - x0Px, y1Px - y0Px);
    const angleDeg = (Math.atan2(y1Px - y0Px, x1Px - x0Px) * 180) / Math.PI;

    setMeasureLine({
      x0Px,
      y0Px,
      lengthPx,
      angleDeg,
      midXPx: (x0Px + x1Px) / 2,
      midYPx: (y0Px + y1Px) / 2,
      label: `${distCm.toFixed(1)} ${wall.unit}`,
    });
  }
  function finish() {
    document.removeEventListener('pointermove', update);
    document.removeEventListener('pointerup', finish);
    setMeasureLine(null);
  }
  update(e);
  document.addEventListener('pointermove', update);
  document.addEventListener('pointerup', finish);
}
