export const distribution = {
  supportUrl: import.meta.env.VITE_SUPPORT_URL || null,
  storeUrl: import.meta.env.VITE_STORE_URL || null,
  isOfficial: import.meta.env.VITE_OFFICIAL_BUILD === 'true',
} as const;

const REPO_URL = 'https://github.com/three-fourteen/minimo-studio';
const CREDITS_MODAL_ID = 'credits-modal';

function openUrl(url: string): void {
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function onCreditsEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeCreditsModal();
}

function closeCreditsModal(): void {
  document.removeEventListener('keydown', onCreditsEscape);
  document.getElementById(CREDITS_MODAL_ID)?.remove();
}

function openCreditsModal(): void {
  if (document.getElementById(CREDITS_MODAL_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = CREDITS_MODAL_ID;
  overlay.className = 'credits-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'credits-modal-title');

  overlay.innerHTML = `
    <div class="credits-modal">
      <button type="button" class="btn btn-icon btn-sm credits-modal-close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"/>
          <path d="m6 6 12 12"/>
        </svg>
      </button>
      <h2 id="credits-modal-title" class="credits-modal-title">Minimo Studio</h2>
      <p class="credits-modal-credit">by Andrés Pi</p>
      <div class="credits-modal-links">
        <button type="button" class="credits-link" data-credits-url="${REPO_URL}">GitHub repository</button>
      </div>
    </div>
  `;

  const links = overlay.querySelector('.credits-modal-links');
  if (links && distribution.supportUrl) {
    const supportBtn = document.createElement('button');
    supportBtn.type = 'button';
    supportBtn.className = 'credits-link';
    supportBtn.dataset.creditsUrl = distribution.supportUrl;
    supportBtn.textContent = 'Support this project';
    links.appendChild(supportBtn);
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeCreditsModal();
  });

  overlay.querySelector('.credits-modal-close')?.addEventListener('click', closeCreditsModal);

  overlay.querySelectorAll<HTMLElement>('[data-credits-url]').forEach((el) => {
    el.addEventListener('click', () => {
      const url = el.dataset.creditsUrl;
      if (url) openUrl(url);
    });
  });

  const app = document.getElementById('app') ?? document.body;
  app.appendChild(overlay);
  document.addEventListener('keydown', onCreditsEscape);
}

export function initCreditsHelp(button: HTMLElement | null): void {
  if (!button) return;
  button.addEventListener('click', openCreditsModal);
}
