import type { WallProjectState } from './state';

/**
 * Fills in defaults for any fields missing from an older save (or a file
 * from an older version of the app) and migrates deprecated formats. Shared
 * by every load path (DB read normalization happens at write time via the
 * PUT route's schema, import happens here; the frontend also calls this
 * directly for localStorage loads/file imports), so all apply the exact
 * same rules. Mutates and returns the given object; throws if it doesn't
 * look like a wall-projector state at all. Ported from the pre-rebuild
 * app.js / web/src/normalizeState.ts and api/app/normalize.py — kept as the
 * one copy now that frontend and backend share a codebase.
 */
export function normalizeState(parsed: unknown): WallProjectState {
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !(parsed as any).wall ||
    !Array.isArray((parsed as any).images)
  ) {
    throw new Error('Not a wall-projector project file');
  }

  const state = parsed as any;

  if (!state.ruler) state.ruler = { length: 100, visible: true, color: '#ffcc00' };
  if (!state.ruler.color) state.ruler.color = '#ffcc00';

  if (!state.background) state.background = { enabled: false, color: '#2a2a2a', projectToo: false };
  if (state.background.projectToo === undefined) state.background.projectToo = false;

  if (!state.defaults) {
    state.defaults = { imageWidth: 30, frameEnabled: false, frameColor: 'black', frameWidth: 3 };
  }

  if (!state.grid) state.grid = { enabled: false, size: 20, projectToo: false };
  if (state.grid.projectToo === undefined) state.grid.projectToo = false;

  if (!state.nail) state.nail = { enabled: false, color: '#ff3b3b', size: 10 };

  if (!state.keystone) state.keystone = { enabled: false, vertical: 0, horizontal: 0 };

  for (const im of state.images) {
    if (!im.frame) im.frame = { enabled: false, color: 'black', width: 3 };
    if (!Array.isArray(im.nails)) {
      const wReal = (im.wPct / 100) * state.wall.width;
      const hReal = (im.hPct / 100) * state.wall.height;
      if (im.nailXPct !== undefined && im.nailYPct !== undefined) {
        // migrate from the old single-nail, box-relative-percentage format
        im.nails = [{ xCm: (im.nailXPct / 100) * wReal, yCm: (im.nailYPct / 100) * hReal }];
      } else {
        im.nails = [{ xCm: wReal / 2, yCm: hReal / 2 }];
      }
    }
    delete im.nailXPct;
    delete im.nailYPct;
    if (im.aspectLocked === undefined) im.aspectLocked = true;
    if (im.crop === undefined) im.crop = false;
    if (im.snapToGrid === undefined) im.snapToGrid = false;
  }

  return state as WallProjectState;
}
