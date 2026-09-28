export type Theme = 'system' | 'light' | 'dark';

const KEY = 'itys-theme';

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* storage blocked */
  }
  return 'system';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked */
  }
  // Keep the browser chrome in step with a manual override.
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim().split(/\s+/).join(',');
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    if (theme === 'system') m.setAttribute('content', m.getAttribute('data-default') ?? '');
    else m.setAttribute('content', `rgb(${paper})`);
  });
}
