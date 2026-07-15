import { useCallback, useEffect, useState } from 'react';

/** Fullscreen ("Project") mode tracking. 1:1 port of app.js's togglePresent()/fullscreenchange handling. */
export function usePresentMode(wallFrameEl: HTMLElement | null) {
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    function onChange() {
      const active = !!document.fullscreenElement;
      setPresenting(active);
      document.body.classList.toggle('presenting', active);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (wallFrameEl) {
      wallFrameEl.requestFullscreen().catch((err) => console.warn('Fullscreen failed', err));
    }
  }, [wallFrameEl]);

  return { presenting, toggle };
}
