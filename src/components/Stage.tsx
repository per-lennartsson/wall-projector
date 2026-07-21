'use client';

import React, { useMemo, useState } from 'react';
import type { ProjectCore } from '../hooks/useProjectCore';
import { useFitCanvas } from '../hooks/useFitCanvas';
import { buildGridTileDataUri, cmToPctX } from '../geometry';
import { ImageLayer } from './ImageLayer';
import { startMeasure, type AlignGuides, type MeasureLine } from '../hooks/interactions';

interface StageProps {
  project: ProjectCore;
  presenting: boolean;
  measureModeActive: boolean;
  onWallFrameEl: (el: HTMLDivElement | null) => void;
  onWallCanvasEl: (el: HTMLDivElement | null) => void;
}

export function Stage({ project, presenting, measureModeActive, onWallFrameEl, onWallCanvasEl }: StageProps) {
  const { state, selectedIds, selectImage } = project;
  const { wall, grid, ruler, keystone, background, images } = state;

  const [wallFrameEl, setWallFrameEl] = useState<HTMLDivElement | null>(null);
  const [wallCanvasEl, setWallCanvasEl] = useState<HTMLDivElement | null>(null);
  const [alignGuides, setAlignGuides] = useState<AlignGuides>({ x: null, y: null });
  const [measureLine, setMeasureLine] = useState<MeasureLine | null>(null);

  const canvasBox = useFitCanvas(wallFrameEl, wall.width, wall.height);

  function attachWallFrameEl(el: HTMLDivElement | null) {
    setWallFrameEl(el);
    onWallFrameEl(el);
  }

  function attachWallCanvasEl(el: HTMLDivElement | null) {
    setWallCanvasEl(el);
    onWallCanvasEl(el);
  }

  const gridVisible = grid.enabled && (!presenting || grid.projectToo);
  const gridBackgroundImage = useMemo(() => {
    if (!gridVisible || canvasBox.width <= 0 || wall.width <= 0) return undefined;
    const scale = canvasBox.width / wall.width;
    const cellPx = Math.max(2, grid.size * scale);
    return { image: buildGridTileDataUri(cellPx), size: `${cellPx}px ${cellPx}px` };
  }, [gridVisible, canvasBox.width, wall.width, grid.size]);

  const keystoneTransform =
    keystone.enabled && (keystone.vertical || keystone.horizontal)
      ? (() => {
          const perspectivePx = Math.max(canvasBox.width, canvasBox.height, 1) * 1.5;
          return `perspective(${perspectivePx}px) rotateX(${keystone.vertical}deg) rotateY(${keystone.horizontal}deg)`;
        })()
      : '';

  const showBgColor = background.enabled && (!presenting || background.projectToo);
  const canvasStyle: React.CSSProperties = {
    width: canvasBox.width + 'px',
    height: canvasBox.height + 'px',
    ...(showBgColor
      ? { backgroundColor: background.color, backgroundImage: 'none' }
      : presenting
        ? { backgroundColor: '#000', backgroundImage: 'none' }
        : {}),
    ['--ruler-color' as any]: ruler.color,
    ['--nail-color' as any]: state.nail.color,
    ['--nail-size' as any]: state.nail.size + 'px',
  };

  const rulerWidthPct = cmToPctX(ruler.length, wall.width);
  const rulerLabel = `${ruler.length} ${wall.unit}`;

  function handleCanvasPointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement;
    if (target !== wallCanvasEl && target.id !== 'wall-warp') return;
    if (measureModeActive) {
      if (wallCanvasEl) startMeasure(e, wallCanvasEl, wall, setMeasureLine);
      return;
    }
    selectImage(null);
  }

  return (
    <main id="stage">
      <div id="wall-frame" ref={attachWallFrameEl}>
        <div
          id="wall-canvas"
          ref={attachWallCanvasEl}
          className={[measureModeActive ? 'measuring' : '', state.nail.enabled ? '' : 'nails-hidden'].filter(Boolean).join(' ')}
          style={canvasStyle}
          onPointerDown={handleCanvasPointerDown}
        >
          <div id="wall-warp" style={{ transform: keystoneTransform }}>
            {gridVisible && gridBackgroundImage && (
              <div
                id="reference-grid"
                style={{ display: 'block', backgroundImage: gridBackgroundImage.image, backgroundSize: gridBackgroundImage.size }}
              />
            )}
            <div id="align-guides">
              {alignGuides.x !== null && <div className="align-guide align-guide-v" style={{ left: alignGuides.x + 'px' }} />}
              {alignGuides.y !== null && <div className="align-guide align-guide-h" style={{ top: alignGuides.y + 'px' }} />}
            </div>

            <div className="calibration-ruler ruler-top" style={{ width: rulerWidthPct + '%', display: ruler.visible ? 'block' : 'none' }}>
              <span className="ruler-label">{rulerLabel}</span>
            </div>
            <div className="calibration-ruler ruler-bottom" style={{ width: rulerWidthPct + '%', display: ruler.visible ? 'block' : 'none' }}>
              <span className="ruler-label">{rulerLabel}</span>
            </div>

            {images.map((im, i) => (
              <ImageLayer
                key={im.id}
                imgState={im}
                wall={wall}
                selected={selectedIds.has(im.id)}
                zIndex={i + 1}
                wallCanvasEl={wallCanvasEl}
                project={project}
                setAlignGuides={setAlignGuides}
              />
            ))}

            {measureLine && (
              <>
                <div
                  className="measure-line"
                  style={{
                    left: measureLine.x0Px + 'px',
                    top: measureLine.y0Px + 'px',
                    width: measureLine.lengthPx + 'px',
                    transform: `rotate(${measureLine.angleDeg}deg)`,
                  }}
                />
                <div
                  className="measure-label"
                  style={{ left: measureLine.midXPx + 'px', top: measureLine.midYPx + 'px' }}
                >
                  {measureLine.label}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="hint" id="stage-hint">
        Drag to move · corner handle to resize (aspect locked, hold Shift to stretch) · top handle to rotate · Delete key to remove
      </p>
    </main>
  );
}
