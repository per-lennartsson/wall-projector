import React, { useRef } from 'react';
import type { ImageState, WallProjectState } from '../types';
import { computeFramePaddingPct, computeNailPct } from '../geometry';
import { startDrag, startNailDrag, startResize, startRotate, type AlignGuides } from '../hooks/interactions';
import type { ProjectCore } from '../hooks/useProjectCore';

interface ImageLayerProps {
  imgState: ImageState;
  wall: WallProjectState['wall'];
  selected: boolean;
  zIndex: number;
  wallCanvasEl: HTMLElement | null;
  project: ProjectCore;
  setAlignGuides: (g: AlignGuides) => void;
}

export function ImageLayer({ imgState, wall, selected, zIndex, wallCanvasEl, project, setAlignGuides }: ImageLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const frame = imgState.frame;
  const framePad = frame.enabled ? computeFramePaddingPct(frame.width, imgState, wall) : null;

  function handleRootPointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement;
    if (target.dataset.role === 'resize-handle' || target.dataset.role === 'rotate-handle' || target.classList.contains('nail-dot')) {
      return;
    }
    e.preventDefault();
    if (!wallCanvasEl) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const partOfExistingMultiSelection = project.selectedIds.has(imgState.id) && project.selectedIds.size > 1;
    if (additive) {
      project.selectImage(imgState.id, { additive: true });
    } else if (!partOfExistingMultiSelection) {
      // A plain click on an image that's already part of a multi-selection
      // keeps the whole selection intact, so drag can move the group —
      // only replace the selection (and bring-to-front) when it isn't.
      project.selectImage(imgState.id);
      project.bringToFront(imgState.id);
    }
    startDrag(e, imgState, wallCanvasEl, project, setAlignGuides);
  }

  function handleResizePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!wallCanvasEl) return;
    project.selectImage(imgState.id);
    startResize(e, imgState, wallCanvasEl, project);
  }

  function handleRotatePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!rootRef.current) return;
    project.selectImage(imgState.id);
    startRotate(e, imgState, rootRef.current, project);
  }

  function handleNailPointerDown(e: React.PointerEvent, nailIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!wallCanvasEl) return;
    project.selectImage(imgState.id);
    startNailDrag(e, nailIndex, imgState, wallCanvasEl, project);
  }

  return (
    <div
      ref={rootRef}
      className={'wall-image' + (selected ? ' selected' : '')}
      data-id={imgState.id}
      style={{
        left: imgState.xPct + '%',
        top: imgState.yPct + '%',
        width: imgState.wPct + '%',
        height: imgState.hPct + '%',
        transform: `rotate(${imgState.rotation}deg)`,
        zIndex,
      }}
      onPointerDown={handleRootPointerDown}
    >
      <div
        className={'wall-image-frame' + (frame.enabled ? ` frame-${frame.color}` : '')}
        style={
          framePad
            ? { left: `-${framePad.leftRightPct}%`, right: `-${framePad.leftRightPct}%`, top: `-${framePad.topBottomPct}%`, bottom: `-${framePad.topBottomPct}%` }
            : { left: 0, right: 0, top: 0, bottom: 0 }
        }
      />
      <img src={imgState.src} draggable={false} style={{ objectFit: imgState.crop ? 'cover' : 'fill' }} alt={imgState.name} />
      <div className="handle handle-resize" data-role="resize-handle" onPointerDown={handleResizePointerDown} />
      <div className="handle handle-rotate" data-role="rotate-handle" onPointerDown={handleRotatePointerDown} />
      {imgState.nails.map((nail, i) => {
        const pct = computeNailPct(nail, imgState, wall);
        return (
          <div
            key={i}
            className="nail-dot"
            style={{ left: pct.leftPct + '%', top: pct.topPct + '%' }}
            onPointerDown={(e) => handleNailPointerDown(e, i)}
          />
        );
      })}
    </div>
  );
}
