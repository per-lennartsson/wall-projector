import React from 'react';
import { FRAME_COLORS, type FrameColor } from '../types';
import { pctToCmX, pctToCmY, cmToPctX, cmToPctY } from '../geometry';
import type { ProjectCore } from '../hooks/useProjectCore';

const FRAME_COLOR_LABELS: Record<FrameColor, string> = {
  'light-wood': 'Light wood',
  'dark-wood': 'Dark wood',
  black: 'Black',
  white: 'White',
};

export function PropsPanel({ project }: { project: ProjectCore }) {
  const { state, selectedIds, getSelected, bulkBringToFront, bulkToggleFrame, bulkRemoveSelected, updateImage, addNail, updateNail, removeNail } =
    project;

  if (selectedIds.size > 1) {
    return (
      <div id="props-panel">
        <p className="hint">{selectedIds.size} images selected.</p>
        <div className="prop-row">
          <button type="button" onClick={bulkBringToFront}>
            Bring all to front
          </button>
        </div>
        <div className="prop-row">
          <button type="button" onClick={bulkToggleFrame}>
            Toggle frame
          </button>
        </div>
        <div className="prop-row">
          <button type="button" className="danger-outline" onClick={bulkRemoveSelected}>
            Delete selected
          </button>
        </div>
        <p className="hint">Drag any selected image to move the whole selection together. Resize/rotate act on a single image — click one alone first.</p>
      </div>
    );
  }

  const im = getSelected();
  if (!im) {
    return (
      <div id="props-panel" className="hint">
        Nothing selected.
      </div>
    );
  }

  const unit = state.wall.unit;
  const xVal = pctToCmX(im.xPct, state.wall.width);
  const yVal = pctToCmY(im.yPct, state.wall.height);
  const wVal = pctToCmX(im.wPct, state.wall.width);
  const hVal = pctToCmY(im.hPct, state.wall.height);
  // Image's own aspect ratio (height/width) — used to keep width/height edits proportional.
  const aspect = im.naturalW && im.naturalH ? im.naturalH / im.naturalW : im.hPct / im.wPct;
  const frame = im.frame;

  return (
    <div id="props-panel" key={im.id}>
      <div className="prop-grid">
        <div className="prop-row">
          <label>X ({unit})</label>
          <input
            type="number"
            step="0.5"
            defaultValue={xVal.toFixed(1)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isNaN(v)) return;
              updateImage(im.id, { xPct: cmToPctX(v, state.wall.width) });
            }}
          />
        </div>
        <div className="prop-row">
          <label>Y ({unit})</label>
          <input
            type="number"
            step="0.5"
            defaultValue={yVal.toFixed(1)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isNaN(v)) return;
              updateImage(im.id, { yPct: cmToPctY(v, state.wall.height) });
            }}
          />
        </div>
        <div className="prop-row">
          <label>Width ({unit})</label>
          <input
            type="number"
            step="0.5"
            min="0.1"
            defaultValue={wVal.toFixed(1)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isNaN(v) || v <= 0) return;
              const patch: any = { wPct: cmToPctX(v, state.wall.width) };
              if (im.aspectLocked) patch.hPct = cmToPctY(v * aspect, state.wall.height);
              updateImage(im.id, patch);
            }}
          />
        </div>
        <div className="prop-row">
          <label>Height ({unit})</label>
          <input
            type="number"
            step="0.5"
            min="0.1"
            defaultValue={hVal.toFixed(1)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isNaN(v) || v <= 0) return;
              const patch: any = { hPct: cmToPctY(v, state.wall.height) };
              if (im.aspectLocked) patch.wPct = cmToPctX(v / aspect, state.wall.width);
              updateImage(im.id, patch);
            }}
          />
        </div>
        <div className="prop-row span-2">
          <label>Rotation °</label>
          <input
            type="number"
            step="1"
            defaultValue={Math.round(im.rotation)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isNaN(v)) return;
              updateImage(im.id, { rotation: v });
            }}
          />
        </div>
      </div>

      <div className="prop-row">
        <label>Lock aspect ratio</label>
        <input
          type="checkbox"
          defaultChecked={im.aspectLocked}
          onChange={(e) => updateImage(im.id, { aspectLocked: e.target.checked })}
        />
      </div>
      <div className="prop-row">
        <label>Crop to fit</label>
        <input type="checkbox" defaultChecked={im.crop} onChange={(e) => updateImage(im.id, { crop: e.target.checked })} />
      </div>
      <p className="hint">
        {im.aspectLocked
          ? "Width/height stay proportional to keep the image's aspect ratio (drag handle: hold Shift to stretch freely)."
          : 'Width/height can be changed independently (drag handle: hold Shift to keep the aspect ratio).'}
      </p>
      <div className="prop-row">
        <label>Snap to grid</label>
        <input type="checkbox" defaultChecked={im.snapToGrid} onChange={(e) => updateImage(im.id, { snapToGrid: e.target.checked })} />
      </div>
      <p className="hint">While dragging, position snaps to the nearest {state.grid.size}{unit} grid line (Settings → Reference grid controls the grid size).</p>

      <div className="prop-row">
        <label>Frame</label>
        <input
          type="checkbox"
          defaultChecked={frame.enabled}
          onChange={(e) => updateImage(im.id, { frame: { ...frame, enabled: e.target.checked } })}
        />
      </div>
      {frame.enabled && (
        <>
          <div className="prop-row">
            <label>Frame color</label>
            <select
              defaultValue={frame.color}
              onChange={(e) => updateImage(im.id, { frame: { ...frame, color: e.target.value as FrameColor } })}
            >
              {FRAME_COLORS.map((c) => (
                <option key={c} value={c}>
                  {FRAME_COLOR_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="prop-row">
            <label>Frame width ({unit})</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              defaultValue={frame.width}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isNaN(v) || v < 0) return;
                updateImage(im.id, { frame: { ...frame, width: v } });
              }}
            />
          </div>
          <p className="hint">
            Width/height above are the photo itself — the frame adds on top, so the total footprint on the wall is bigger by the frame width on
            each side.
          </p>
        </>
      )}

      <div className="prop-row">
        <label>Nails</label>
        <button id="prop-nail-add" type="button" onClick={() => addNail(im.id)}>
          + Add nail
        </button>
      </div>
      <div id="prop-nails-list">
        {im.nails.map((nail, i) => (
          <div className="nail-row" key={i}>
            <input
              type="number"
              step="0.5"
              title={`X (${unit})`}
              defaultValue={nail.xCm.toFixed(1)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isNaN(v)) return;
                updateNail(im.id, i, { xCm: v });
              }}
            />
            <input
              type="number"
              step="0.5"
              title={`Y (${unit})`}
              defaultValue={nail.yCm.toFixed(1)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isNaN(v)) return;
                updateNail(im.id, i, { yCm: v });
              }}
            />
            <button type="button" className="delete-btn" title="Remove nail" onClick={() => removeNail(im.id, i)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <p className="hint">Hanging-point dot position(s), in {unit} from the photo's own top-left corner. Drag a dot on the wall instead if that's easier.</p>
    </div>
  );
}
