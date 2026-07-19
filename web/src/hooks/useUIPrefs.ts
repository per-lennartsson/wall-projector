import { useCallback, useEffect, useRef, useState } from 'react';
import { loadUIPrefs, resolveEffectiveTheme, saveUIPrefs, type ThemeChoice, type UIPrefs } from '../storage/uiPrefs';

/**
 * Sidebar-collapse / layers-density / theme prefs, in their own localStorage
 * key separate from project state (per-browser display prefs, not project
 * data). 1:1 port of app.js's uiPrefs/applyTheme/setSidebarCollapsed/etc.
 */
export function useUIPrefs() {
  const [prefs, setPrefs] = useState<UIPrefs>(() => loadUIPrefs());
  const systemPrefersLightRef = useRef(
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)').matches : false,
  );
  const [, forceRerender] = useState(0);

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      systemPrefersLightRef.current = query.matches;
      if (prefsRef.current.theme === 'system') forceRerender((n) => n + 1);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const effectiveTheme = resolveEffectiveTheme(prefs.theme, systemPrefersLightRef.current);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', prefs.sidebarCollapsed);
  }, [prefs.sidebarCollapsed]);

  useEffect(() => {
    document.body.classList.toggle('layers-compact', prefs.layersCompact);
  }, [prefs.layersCompact]);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setPrefs((p) => {
      const next = { ...p, sidebarCollapsed: collapsed };
      saveUIPrefs(next);
      return next;
    });
  }, []);

  const setLayersCompact = useCallback((compact: boolean) => {
    setPrefs((p) => {
      const next = { ...p, layersCompact: compact };
      saveUIPrefs(next);
      return next;
    });
  }, []);

  const setTheme = useCallback((theme: ThemeChoice) => {
    setPrefs((p) => {
      const next = { ...p, theme };
      saveUIPrefs(next);
      return next;
    });
  }, []);

  return { prefs, effectiveTheme, setSidebarCollapsed, setLayersCompact, setTheme };
}
