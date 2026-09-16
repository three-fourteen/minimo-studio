export const distribution = {
  supportUrl: import.meta.env.VITE_SUPPORT_URL || null,
  storeUrl: import.meta.env.VITE_STORE_URL || null,
  isOfficial: import.meta.env.VITE_OFFICIAL_BUILD === 'true',
} as const;

function openUrl(url: string): void {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function mountSupportAction(parent: HTMLElement): void {
  if (!distribution.isOfficial || !distribution.supportUrl) return;

  const url = distribution.supportUrl;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-ghost btn-sm';
  btn.textContent = 'Support this project';
  btn.addEventListener('click', () => {
    openUrl(url);
  });

  const themeToggle = parent.querySelector('#btn-theme-toggle');
  if (themeToggle?.nextSibling) {
    parent.insertBefore(btn, themeToggle.nextSibling);
  } else {
    parent.appendChild(btn);
  }
}
