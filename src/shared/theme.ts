export type ThemeMode = 'system' | 'light' | 'dark';

export async function getStoredTheme(): Promise<ThemeMode> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const res = await chrome.storage.local.get(['themeMode']);
    if (res.themeMode) return res.themeMode as ThemeMode;
  }
  return 'system';
}

export async function setStoredTheme(mode: ThemeMode): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({ themeMode: mode });
  }
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
}

export function getThemeIconSvg(mode: ThemeMode): string {
  if (mode === 'light') {
    // Sun Icon
    return `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2"/>
        <path d="M12 20v2"/>
        <path d="m4.93 4.93 1.41 1.41"/>
        <path d="m17.66 17.66 1.41 1.41"/>
        <path d="M2 12h2"/>
        <path d="M20 12h2"/>
        <path d="m6.34 17.66-1.41 1.41"/>
        <path d="m19.07 4.93-1.41 1.41"/>
      </svg>
    `;
  } else if (mode === 'dark') {
    // Moon Icon
    return `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
    `;
  } else {
    // System / Auto Monitor Icon
    return `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2"/>
        <line x1="8" x2="16" y1="21" y2="21"/>
        <line x1="12" x2="12" y1="17" y2="21"/>
      </svg>
    `;
  }
}

export function getThemeTitle(mode: ThemeMode): string {
  if (mode === 'system') return 'Theme: System Auto (Click to switch)';
  if (mode === 'light') return 'Theme: Light Mode (Click to switch)';
  return 'Theme: Dark Mode (Click to switch)';
}

export async function initTheme(toggleButton?: HTMLElement | null): Promise<void> {
  const currentMode = await getStoredTheme();
  applyTheme(currentMode);

  if (toggleButton) {
    const updateButton = (mode: ThemeMode) => {
      toggleButton.innerHTML = getThemeIconSvg(mode);
      toggleButton.title = getThemeTitle(mode);
    };

    updateButton(currentMode);

    toggleButton.addEventListener('click', async () => {
      let nextMode: ThemeMode = 'system';
      const active = (document.documentElement.dataset.theme as ThemeMode) || 'system';

      if (active === 'system') {
        // If system, switch to light or dark based on opposite of system
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        nextMode = prefersDark ? 'light' : 'dark';
      } else if (active === 'light') {
        nextMode = 'dark';
      } else {
        nextMode = 'system';
      }

      applyTheme(nextMode);
      updateButton(nextMode);
      await setStoredTheme(nextMode);
    });
  }

  // Live listener for OS theme changes when in 'system' mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (document.documentElement.dataset.theme === 'system') {
      applyTheme('system');
    }
  });

  // Storage listener across popup & sidepanel
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.themeMode?.newValue) {
        const newMode = changes.themeMode.newValue as ThemeMode;
        applyTheme(newMode);
        if (toggleButton) {
          toggleButton.innerHTML = getThemeIconSvg(newMode);
          toggleButton.title = getThemeTitle(newMode);
        }
      }
    });
  }
}
