import type { WallProjectState } from './types';

/**
 * Fills in defaults for any fields missing from an older save (or a file from
 * an older version of the app) and migrates deprecated formats. Shared by the
 * localStorage load path and file import, so both apply the exact same
 * rules. Mutates and returns the given object; throws if it doesn't look like
 * a wall-projector state at all. 1:1 port of app.js's normalizeState().
 */
export function normalizeState(parsed: any): WallProjectState {
  if (!parsed || !parsed.wall || !Array.isArray(parsed.images)) {
    throw new Error('Not a wall-projector project file');
  }
  if (!parsed.ruler) parsed.ruler = { length: 100, visible: true, color: '#ffcc00' };
  if (!parsed.ruler.color) parsed.ruler.color = '#ffcc00';
  if (!parsed.background) parsed.background = { enabled: false, color: '#2a2a2a', projectToo: false };
  if (parsed.background.projectToo === undefined) parsed.background.projectToo = false;
  if (!parsed.defaults) {
    parsed.defaults = { imageWidth: 30, frameEnabled: false, frameColor: 'black', frameWidth: 3 };
  }
  if (!parsed.grid) parsed.grid = { enabled: false, size: 20, projectToo: false };
  if (parsed.grid.projectToo === undefined) parsed.grid.projectToo = false;
  if (!parsed.nail) parsed.nail = { enabled: false, color: '#ff3b3b', size: 10 };
  if (!parsed.keystone) parsed.keystone = { enabled: false, vertical: 0, horizontal: 0 };
  parsed.images.forEach((im: any) => {
    if (!im.frame) im.frame = { enabled: false, color: 'black', width: 3 };
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
    delete im.nailXPct;
    delete im.nailYPct;
    if (im.aspectLocked === undefined) im.aspectLocked = true;
    if (im.crop === undefined) im.crop = false;
    if (im.snapToGrid === undefined) im.snapToGrid = false;
  });
  return parsed as WallProjectState;
}
