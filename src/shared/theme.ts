export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

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

export function getResolvedTheme(mode: ThemeMode): ResolvedTheme {
  switch (mode) {
    case 'light':
      return 'light';
    case 'dark':
      return 'dark';
    case 'system':
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function getThemeIconSvg(mode: ThemeMode): string {
  const resolved = getResolvedTheme(mode);
  switch (resolved) {
    case 'light':
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
    case 'dark':
      return `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
    `;
    default: {
      const _exhaustive: never = resolved;
      return _exhaustive;
    }
  }
}

export function getThemeTitle(mode: ThemeMode): string {
  switch (mode) {
    case 'system':
      return 'Theme: System Auto (Click to switch)';
    case 'light':
      return 'Theme: Light Mode (Click to switch)';
    case 'dark':
      return 'Theme: Dark Mode (Click to switch)';
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

function nextThemeMode(active: ThemeMode): ThemeMode {
  switch (active) {
    case 'system':
      return getResolvedTheme('system') === 'dark' ? 'light' : 'dark';
    case 'light':
      return 'dark';
    case 'dark':
      return 'system';
    default: {
      const _exhaustive: never = active;
      return _exhaustive;
    }
  }
}

export async function initTheme(toggleButton?: HTMLElement | null): Promise<void> {
  const currentMode = await getStoredTheme();
  applyTheme(currentMode);

  const updateButton = (mode: ThemeMode) => {
    if (!toggleButton) return;
    toggleButton.innerHTML = getThemeIconSvg(mode);
    toggleButton.title = getThemeTitle(mode);
  };

  updateButton(currentMode);

  if (toggleButton) {
    toggleButton.addEventListener('click', async () => {
      const active = (document.documentElement.dataset.theme as ThemeMode) || 'system';
      const nextMode = nextThemeMode(active);
      applyTheme(nextMode);
      updateButton(nextMode);
      await setStoredTheme(nextMode);
    });
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (document.documentElement.dataset.theme === 'system') {
      applyTheme('system');
      updateButton('system');
    }
  });

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.themeMode?.newValue) {
        const newMode = changes.themeMode.newValue as ThemeMode;
        applyTheme(newMode);
        updateButton(newMode);
      }
    });
  }
}
