import { useEffect, useState } from 'react';

export interface CanvasBox {
  width: number;
  height: number;
}

/**
 * The canvas has no intrinsic size of its own (a flex item centered in
 * #wall-frame), so its pixel box is computed explicitly from the wall's
 * aspect ratio and whatever space #wall-frame currently has available.
 * Re-runs on ResizeObserver (wall-frame resize, e.g. sidebar
 * collapse/fullscreen) and window resize. 1:1 port of app.js's fitCanvas().
 */
export function useFitCanvas(
  wallFrameEl: HTMLElement | null,
  wallWidth: number,
  wallHeight: number,
): CanvasBox {
  const [box, setBox] = useState<CanvasBox>({ width: 0, height: 0 });

  useEffect(() => {
    if (!wallFrameEl) return;

    function recompute() {
      const rect = wallFrameEl!.getBoundingClientRect();
      const availW = rect.width;
      const availH = rect.height;
      if (availW <= 0 || availH <= 0) return;
      const ratio = wallWidth / wallHeight;
      let w: number, h: number;
      if (availW / availH > ratio) {
        h = availH;
        w = h * ratio;
      } else {
        w = availW;
        h = w / ratio;
      }
      setBox({ width: w, height: h });
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(wallFrameEl);
    window.addEventListener('resize', recompute);
    // Give the browser a frame to settle the new layout before measuring it.
    const onFullscreenChange = () => requestAnimationFrame(recompute);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recompute);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [wallFrameEl, wallWidth, wallHeight]);

  return box;
}
