import type { ImageState, WallProjectState } from './types';

// Real-world units <-> canvas percentages. The wall's width/height define
// what one percent along each axis is worth in the wall's chosen unit.
// 1:1 port of app.js's cmToPctX/Y, pctToCmX/Y.
export function cmToPctX(v: number, wallWidth: number): number {
  return (v / wallWidth) * 100;
}
export function cmToPctY(v: number, wallHeight: number): number {
  return (v / wallHeight) * 100;
}
export function pctToCmX(pct: number, wallWidth: number): number {
  return (pct / 100) * wallWidth;
}
export function pctToCmY(pct: number, wallHeight: number): number {
  return (pct / 100) * wallHeight;
}

// Rounds a real-world cm coordinate to the nearest grid line.
export function snapCmToGrid(cm: number, gridSize: number): number {
  return gridSize > 0 ? Math.round(cm / gridSize) * gridSize : cm;
}

/**
 * wPct/hPct/xPct/yPct are each relative to the wall's own width/height, so if
 * only one dimension changes, an image's real-world size and position would
 * otherwise skew (and its aspect ratio would break). This captures real-world
 * geometry under the OLD wall size first, then re-derives percentages under
 * the NEW size so images keep their physical size/position on the wall.
 *
 * HIGH-RISK PORT: must remain one synchronous pure function over a full
 * snapshot of images — never split across renders/setState calls, or a
 * mid-computation re-render could read stale wall dims for some images and
 * new dims for others, silently reintroducing the original aspect-distortion
 * bug this function exists to fix. 1:1 port of app.js's applyWallSize().
 */
export function recomputeImagesForWallResize(
  images: ImageState[],
  oldWall: { width: number; height: number },
  newWall: { width: number; height: number },
): ImageState[] {
  const real = images.map((im) => ({
    im,
    xCm: pctToCmX(im.xPct, oldWall.width),
    yCm: pctToCmY(im.yPct, oldWall.height),
    wCm: pctToCmX(im.wPct, oldWall.width),
    hCm: pctToCmY(im.hPct, oldWall.height),
  }));
  return real.map(({ im, xCm, yCm, wCm, hCm }) => ({
    ...im,
    xPct: cmToPctX(xCm, newWall.width),
    yPct: cmToPctY(yCm, newWall.height),
    wPct: cmToPctX(wCm, newWall.width),
    hPct: cmToPctY(hCm, newWall.height),
  }));
}

/**
 * Nail positions are stored as cm offsets from the photo's own top-left
 * corner (so they stay physically meaningful regardless of image size),
 * converted here to a percentage of the photo's own box for CSS. Only ever
 * derive this at render time — never persist nails as a percentage.
 */
export function computeNailPct(
  nail: { xCm: number; yCm: number },
  imgState: Pick<ImageState, 'wPct' | 'hPct'>,
  wall: Pick<WallProjectState['wall'], 'width' | 'height'>,
): { leftPct: number; topPct: number } {
  const boxWidthReal = pctToCmX(imgState.wPct, wall.width);
  const boxHeightReal = pctToCmY(imgState.hPct, wall.height);
  return {
    leftPct: boxWidthReal > 0 ? (nail.xCm / boxWidthReal) * 100 : 0,
    topPct: boxHeightReal > 0 ? (nail.yCm / boxHeightReal) * 100 : 0,
  };
}

/**
 * The frame grows the footprint outward from the photo's own box, rather
 * than shrinking the photo inside a fixed footprint. top/bottom percentages
 * resolve (in CSS) against the box's own height and left/right against its
 * width — a CSS quirk where percentage padding/inset always resolves against
 * the box's own WIDTH regardless of side, so computing left/right and
 * top/bottom separately (instead of one shared percentage) keeps the border
 * an even physical thickness on all four sides.
 *
 * HIGH-RISK PORT: keep this an explicit computation, never delegate to a CSS
 * utility class that might resolve percentages differently.
 */
export function computeFramePaddingPct(
  frameWidthCm: number,
  imgState: Pick<ImageState, 'wPct' | 'hPct'>,
  wall: Pick<WallProjectState['wall'], 'width' | 'height'>,
): { leftRightPct: number; topBottomPct: number } {
  const boxWidthReal = pctToCmX(imgState.wPct, wall.width);
  const boxHeightReal = pctToCmY(imgState.hPct, wall.height);
  return {
    leftRightPct: boxWidthReal > 0 ? Math.max(0, (frameWidthCm / boxWidthReal) * 100) : 0,
    topBottomPct: boxHeightReal > 0 ? Math.max(0, (frameWidthCm / boxHeightReal) * 100) : 0,
  };
}

export interface EdgesPx {
  left: number;
  right: number;
  centerX: number;
  top: number;
  bottom: number;
  centerY: number;
}

// Bounding-box edges of an image in px relative to the canvas, ignoring
// rotation — same screen-space simplification the drag/resize handlers use
// throughout (deliberate, not a bug).
export function getImageEdgesPx(
  imgState: Pick<ImageState, 'xPct' | 'yPct' | 'wPct' | 'hPct'>,
  rect: { width: number; height: number },
): EdgesPx {
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

// A tiled SVG (dashed line along each cell's top+left edge) reads as a
// dotted grid of LINES rather than isolated dots at the intersections. 1:1
// port of app.js's buildGridTile().
export function buildGridTileDataUri(cellPx: number): string {
  const c = Math.max(4, Math.round(cellPx));
  const color = 'rgba(255,255,255,0.4)';
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${c}' height='${c}'>` +
    `<line x1='0' y1='0.5' x2='${c}' y2='0.5' stroke='${color}' stroke-dasharray='1,3'/>` +
    `<line x1='0.5' y1='0' x2='0.5' y2='${c}' stroke='${color}' stroke-dasharray='1,3'/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const ALIGN_SNAP_PX = 6;

export interface AlignSnapResult {
  xPct?: number;
  yPct?: number;
  guideX: number | null;
  guideY: number | null;
}

/**
 * Compares the dragged image's edges/center against every other image's,
 * snapping xPct/yPct to the closest match on each axis (independently) and
 * returning the matched px coordinates to draw guide lines at. 1:1 port of
 * app.js's applyAlignmentSnap(), but pure (returns deltas instead of
 * mutating imgState).
 */
export function computeAlignmentSnap(
  dragged: Pick<ImageState, 'id' | 'xPct' | 'yPct' | 'wPct' | 'hPct'>,
  others: Pick<ImageState, 'id' | 'xPct' | 'yPct' | 'wPct' | 'hPct'>[],
  rect: { width: number; height: number },
): AlignSnapResult {
  const draggedEdges = getImageEdgesPx(dragged, rect);
  let bestX: { distance: number; guidePx: number; deltaPx: number } | null = null;
  let bestY: { distance: number; guidePx: number; deltaPx: number } | null = null;

  others.forEach((other) => {
    if (other.id === dragged.id) return;
    const o = getImageEdgesPx(other, rect);
    (
      [
        [draggedEdges.left, o.left],
        [draggedEdges.left, o.right],
        [draggedEdges.right, o.left],
        [draggedEdges.right, o.right],
        [draggedEdges.centerX, o.centerX],
      ] as const
    ).forEach(([draggedPx, otherPx]) => {
      const distance = Math.abs(draggedPx - otherPx);
      if (distance <= ALIGN_SNAP_PX && (!bestX || distance < bestX.distance)) {
        bestX = { distance, guidePx: otherPx, deltaPx: otherPx - draggedPx };
      }
    });
    (
      [
        [draggedEdges.top, o.top],
        [draggedEdges.top, o.bottom],
        [draggedEdges.bottom, o.top],
        [draggedEdges.bottom, o.bottom],
        [draggedEdges.centerY, o.centerY],
      ] as const
    ).forEach(([draggedPx, otherPx]) => {
      const distance = Math.abs(draggedPx - otherPx);
      if (distance <= ALIGN_SNAP_PX && (!bestY || distance < bestY.distance)) {
        bestY = { distance, guidePx: otherPx, deltaPx: otherPx - draggedPx };
      }
    });
  });

  const result: AlignSnapResult = { guideX: null, guideY: null };
  if (bestX) {
    result.xPct = dragged.xPct + ((bestX as any).deltaPx / rect.width) * 100;
    result.guideX = (bestX as any).guidePx;
  }
  if (bestY) {
    result.yPct = dragged.yPct + ((bestY as any).deltaPx / rect.height) * 100;
    result.guideY = (bestY as any).guidePx;
  }
  return result;
}
