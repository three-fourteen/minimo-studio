import { CaptureSlice, StitchPayload } from '../shared/types';

const MAX_CSS_PAGE_HEIGHT = 16384;
const SLICE_SETTLE_MS = 220;
/** Chrome quota: MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND = 2. */
const MIN_CAPTURE_GAP_MS = 550;
const CAPTURE_QUOTA_RETRIES = 4;

let lastVisibleTabCaptureAt = 0;

export interface PageMetrics {
  pageWidth: number;
  pageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  dpr: number;
}

interface OverlayStyle {
  el: HTMLElement;
  visibility: string;
}

interface PageRestoreState {
  scrollX: number;
  scrollY: number;
  overlays: OverlayStyle[];
  scrollbarStyle: HTMLStyleElement | null;
}

export const CAPTURE_RESTRICTED_MESSAGE =
  "Can't capture this page. Open a normal website (https), then try again.";

export const CAPTURE_TAB_HIDDEN_MESSAGE =
  'Capture aborted: the page is no longer the visible tab.';

export function isRestrictedCaptureUrl(url: string | undefined): boolean {
  // Without the `tabs` permission, privileged pages (chrome://, NTP, Web Store)
  // omit `tab.url`. Injecting then throws "Cannot access a chrome:// URL".
  if (!url) return true;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === 'chrome:' ||
      parsed.protocol === 'chrome-extension:' ||
      parsed.protocol === 'edge:' ||
      parsed.protocol === 'about:' ||
      parsed.protocol === 'devtools:' ||
      parsed.protocol === 'view-source:'
    ) {
      return true;
    }
    if (parsed.hostname === 'chromewebstore.google.com') return true;
    if (parsed.hostname === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function screenshotFilename(url: string | undefined): string {
  let host = 'page';
  if (url) {
    try {
      host = new URL(url).hostname.replace(/[^\w.-]+/g, '_') || 'page';
    } catch {
      host = 'page';
    }
  }
  const date = new Date().toISOString().slice(0, 10);
  return `page-screenshot-${host}-${date}.png`;
}

/**
 * Injected into the tab. Must be self-contained (serialized by executeScript).
 */
export function preparePageCapture(): PageMetrics {
  const restoreKey = '__minimoFullPageCaptureRestore';
  const root = document.documentElement;
  const body = document.body;
  const overlays: OverlayStyle[] = [];

  if (body) {
    const nodes = body.getElementsByTagName('*');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as HTMLElement;
      if (el === root || el === body) continue;
      const position = window.getComputedStyle(el).position;
      if (position !== 'fixed' && position !== 'sticky') continue;
      overlays.push({ el, visibility: el.style.visibility });
    }
  }

  const scrollbarStyle = document.createElement('style');
  scrollbarStyle.setAttribute('data-minimo-capture', 'scrollbar');
  scrollbarStyle.textContent =
    'html::-webkit-scrollbar,body::-webkit-scrollbar,*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}' +
    'html,body{scrollbar-width:none!important}';
  (document.head || root).appendChild(scrollbarStyle);

  const state: PageRestoreState = {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    overlays,
    scrollbarStyle,
  };
  (window as unknown as Record<string, PageRestoreState>)[restoreKey] = state;

  const pageWidth = Math.max(root.scrollWidth, body?.scrollWidth ?? 0, root.clientWidth);
  const pageHeight = Math.max(root.scrollHeight, body?.scrollHeight ?? 0, root.clientHeight);

  return {
    pageWidth,
    pageHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };
}

export function scrollPageTo(y: number): void {
  window.scrollTo(0, y);
}

/** Hide sticky/fixed overlays after the first (top) slice so they don't repeat. */
export function hideCaptureOverlays(): void {
  const restoreKey = '__minimoFullPageCaptureRestore';
  const state = (window as unknown as Record<string, PageRestoreState | undefined>)[restoreKey];
  if (!state) return;
  for (const item of state.overlays) {
    item.el.style.visibility = 'hidden';
  }
}

export function restorePageCapture(): void {
  const restoreKey = '__minimoFullPageCaptureRestore';
  const bag = window as unknown as Record<string, PageRestoreState | undefined>;
  const state = bag[restoreKey];
  if (!state) return;
  for (const item of state.overlays) {
    item.el.style.visibility = item.visibility;
  }
  state.scrollbarStyle?.remove();
  window.scrollTo(state.scrollX, state.scrollY);
  delete bag[restoreKey];
}

export async function captureFullPageSlices(tab: chrome.tabs.Tab): Promise<{
  payload: StitchPayload;
  filename: string;
}> {
  const tabId = tab.id;
  if (tabId == null) {
    throw new Error('No tab to capture');
  }
  if (isRestrictedCaptureUrl(tab.url ?? tab.pendingUrl)) {
    throw new Error(CAPTURE_RESTRICTED_MESSAGE);
  }

  let shouldRestore = false;
  try {
    let prep: chrome.scripting.InjectionResult<PageMetrics> | undefined;
    try {
      [prep] = await chrome.scripting.executeScript({
        target: { tabId },
        func: preparePageCapture,
      });
      shouldRestore = true;
    } catch (err) {
      shouldRestore = true;
      throw wrapPrivilegedPageError(err);
    }

    const metrics = prep?.result;
    if (!metrics) {
      throw new Error('Failed to measure page');
    }

    await ensureTabIsActive(tabId);

    const viewportHeight = Math.max(1, Math.floor(metrics.viewportHeight));
    const pageHeight = Math.min(
      MAX_CSS_PAGE_HEIGHT,
      Math.max(viewportHeight, Math.ceil(metrics.pageHeight))
    );
    const slices: CaptureSlice[] = [];
    let y = 0;

    while (y < pageHeight) {
      const scrollY = Math.min(y, Math.max(0, pageHeight - viewportHeight));
      await chrome.scripting.executeScript({
        target: { tabId },
        func: scrollPageTo,
        args: [scrollY],
      }).catch((err) => {
        throw wrapPrivilegedPageError(err);
      });
      await delay(SLICE_SETTLE_MS);
      await ensureTabIsActive(tabId);
      const dataUrl = await captureVisibleTabThrottled(tab.windowId);
      slices.push({ dataUrl, y: scrollY });
      if (slices.length === 1 && scrollY + viewportHeight < pageHeight) {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: hideCaptureOverlays,
        });
      }
      if (scrollY + viewportHeight >= pageHeight) break;
      y += viewportHeight;
    }

    if (slices.length === 0) {
      throw new Error('No screenshot slices captured');
    }

    const filename = screenshotFilename(tab.url ?? tab.pendingUrl);
    return {
      payload: {
        slices,
        viewportHeight,
        pageHeight,
        dpr: metrics.dpr || 1,
        filename,
      },
      filename,
    };
  } finally {
    if (shouldRestore) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: restorePageCapture,
        });
      } catch {
        // Tab may have closed or become restricted.
      }
    }
  }
}

async function ensureTabIsActive(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.active) {
    await chrome.tabs.update(tabId, { active: true });
  }
  const visible = await chrome.tabs.get(tabId);
  if (!visible.active) {
    throw new Error(CAPTURE_TAB_HIDDEN_MESSAGE);
  }
}

function isCaptureQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /MAX_CAPTURE_VISIBLE_TAB/i.test(message);
}

async function captureVisibleTabThrottled(windowId: number): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= CAPTURE_QUOTA_RETRIES; attempt++) {
    const elapsed = Date.now() - lastVisibleTabCaptureAt;
    const waitMs = Math.max(0, MIN_CAPTURE_GAP_MS - elapsed);
    if (waitMs > 0) await delay(waitMs);

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
      lastVisibleTabCaptureAt = Date.now();
      return dataUrl;
    } catch (err) {
      lastError = err;
      lastVisibleTabCaptureAt = Date.now();
      if (!isCaptureQuotaError(err) || attempt === CAPTURE_QUOTA_RETRIES) {
        throw err;
      }
      await delay(MIN_CAPTURE_GAP_MS * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Screenshot capture failed');
}

function wrapPrivilegedPageError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/chrome:\/\//i.test(message) || /cannot access/i.test(message)) {
    return new Error(CAPTURE_RESTRICTED_MESSAGE);
  }
  return err instanceof Error ? err : new Error(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
