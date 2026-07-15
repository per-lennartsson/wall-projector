export type ThemeChoice = 'system' | 'light' | 'dark';

export interface UIPrefs {
  sidebarCollapsed: boolean;
  layersCompact: boolean;
  theme: ThemeChoice;
}

const UI_STORAGE_KEY = 'wallProjectorUI.v1';

const DEFAULT_UI_PREFS: UIPrefs = { sidebarCollapsed: false, layersCompact: false, theme: 'dark' };

export function loadUIPrefs(): UIPrefs {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (raw) return { ...DEFAULT_UI_PREFS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Could not load UI prefs', e);
  }
  return { ...DEFAULT_UI_PREFS };
}

export function saveUIPrefs(prefs: UIPrefs): void {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Could not save UI prefs', e);
  }
}

// 'system' resolves live via the OS/browser's prefers-color-scheme.
export function resolveEffectiveTheme(theme: ThemeChoice, systemPrefersLight: boolean): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  return systemPrefersLight ? 'light' : 'dark';
}
