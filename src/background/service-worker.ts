import { captureFullPageSlices } from './full-page-capture';
import { getLastFocusedNormalTab } from '../shared/active-tab';
import { ImageFormat } from '../shared/types';

const MENU_PARENT = 'opticonvert-parent';
const MENU_CONVERT_WEBP = 'opticonvert-webp';
const MENU_CONVERT_PNG = 'opticonvert-png';
const MENU_CONVERT_JPG = 'opticonvert-jpg';
const MENU_CONVERT_AVIF = 'opticonvert-avif';
const MENU_OPEN_SIDEPANEL = 'opticonvert-open-sidepanel';
const MENU_FULL_PAGE_SCREENSHOT = 'minimo-full-page-screenshot';
const SCREENSHOT_READY_RETRIES = 5;
const SCREENSHOT_READY_GAP_MS = 400;

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

function createContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_FULL_PAGE_SCREENSHOT,
      title: 'Capture full page in Studio…',
      contexts: ['page', 'image', 'frame'],
    });

    chrome.contextMenus.create({
      id: MENU_PARENT,
      title: 'Minimo Studio',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: MENU_CONVERT_WEBP,
      parentId: MENU_PARENT,
      title: 'Download as WebP (Recommended)',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: MENU_CONVERT_PNG,
      parentId: MENU_PARENT,
      title: 'Download as PNG',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: MENU_CONVERT_JPG,
      parentId: MENU_PARENT,
      title: 'Download as JPG',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: MENU_CONVERT_AVIF,
      parentId: MENU_PARENT,
      title: 'Download as AVIF',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: 'minimo-sep',
      parentId: MENU_PARENT,
      type: 'separator',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: MENU_OPEN_SIDEPANEL,
      parentId: MENU_PARENT,
      title: 'Open in Minimo Studio...',
      contexts: ['image'],
    });
  });
}

function openSidePanelFromTab(tab?: chrome.tabs.Tab, tabId?: number): Promise<void> {
  if (typeof chrome.sidePanel?.open !== 'function') {
    return Promise.resolve();
  }
  if (tab?.id != null) {
    return chrome.sidePanel.open({ tabId: tab.id });
  }
  if (tabId != null) {
    return chrome.sidePanel.open({ tabId });
  }
  if (tab?.windowId != null) {
    return chrome.sidePanel.open({ windowId: tab.windowId });
  }
  return Promise.resolve();
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_FULL_PAGE_SCREENSHOT) {
    const openPromise = openSidePanelFromTab(tab);
    void (async () => {
      try {
        await runFullPageCapture(tab, openPromise);
      } catch (err) {
        console.error('Full page capture failed:', err);
        await showActionError();
      }
    })();
    return;
  }

  if (!info.srcUrl) return;

  const srcUrl = info.srcUrl;

  if (info.menuItemId === MENU_OPEN_SIDEPANEL) {
    const openPromise = openSidePanelFromTab(tab);

    void (async () => {
      try {
        await chrome.storage.local.set({ pendingContextMenuImage: srcUrl });
        await openPromise;
      } catch (err) {
        console.error('Error opening side panel:', err);
        await showActionError();
      }
    })();
    return;
  }

  let targetFormat: ImageFormat | null = null;
  if (info.menuItemId === MENU_CONVERT_WEBP) targetFormat = 'webp';
  else if (info.menuItemId === MENU_CONVERT_PNG) targetFormat = 'png';
  else if (info.menuItemId === MENU_CONVERT_JPG) targetFormat = 'jpeg';
  else if (info.menuItemId === MENU_CONVERT_AVIF) targetFormat = 'avif';

  if (!targetFormat) return;

  void (async () => {
    try {
      await ensureOffscreenDocument();

      const response = await chrome.runtime.sendMessage({
        type: 'OFFSCREEN_CONVERT',
        payload: {
          srcUrl,
          format: targetFormat,
          quality: 0.85,
        },
      });

      if (!response?.success || (!response.result?.dataUrl && !response.result?.blobUrl)) {
        console.error('Offscreen conversion failed:', response?.error);
        await showActionError();
        return;
      }

      await downloadConvertedFile(response.result);
      await showActionOk();
    } catch (err) {
      console.error('Failed to convert and download image via offscreen document:', err);
      await showActionError();
    }
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type as string | undefined;

  if (type !== 'CAPTURE_FULL_PAGE') return;

  const tabId = typeof message.tabId === 'number' ? message.tabId : sender.tab?.id;
  const openPromise = openSidePanelFromTab(undefined, tabId);

  void (async () => {
    try {
      const tab = await resolveTab(tabId);
      await runFullPageCapture(tab, openPromise);
      sendResponse({ success: true });
    } catch (err) {
      console.error('Full page capture failed:', err);
      await showActionError();
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Capture failed',
      });
    }
  })();

  return true;
});

async function resolveTab(tabId: number | undefined): Promise<chrome.tabs.Tab | undefined> {
  if (tabId != null) {
    try {
      return await chrome.tabs.get(tabId);
    } catch {
      // Fall through to last focused normal browser window.
    }
  }
  return getLastFocusedNormalTab();
}

async function runFullPageCapture(
  tab: chrome.tabs.Tab | undefined,
  openPromise: Promise<void>
): Promise<void> {
  void openPromise.catch((err) => {
    console.error('Failed to open side panel:', err);
  });

  const locked = await acquireCaptureLock();
  if (!locked) {
    throw new Error('A capture is already running');
  }

  try {
    if (!tab?.id) {
      throw new Error('No tab to capture');
    }

    const { payload } = await captureFullPageSlices(tab);
    await ensureOffscreenDocument();

    const response = await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_STITCH',
      payload,
    });

    if (!response?.success || !response.result?.dataUrl) {
      throw new Error(response?.error || 'Stitch failed');
    }

    await notifyScreenshotReady();
    await showActionOk();
  } finally {
    await chrome.storage.session.set({ captureState: 'idle' });
  }
}

async function notifyScreenshotReady(): Promise<void> {
  for (let attempt = 0; attempt < SCREENSHOT_READY_RETRIES; attempt++) {
    try {
      await chrome.runtime.sendMessage({ type: 'SCREENSHOT_READY' });
    } catch {
      // Studio may not be listening yet; offscreen still holds the PNG.
    }
    if (attempt < SCREENSHOT_READY_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_READY_GAP_MS));
    }
  }
}

async function acquireCaptureLock(): Promise<boolean> {
  const { captureState = 'idle' } = await chrome.storage.session.get('captureState');
  if (captureState === 'capturing') return false;
  await chrome.storage.session.set({ captureState: 'capturing' });
  return true;
}

let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  if (chrome.offscreen?.hasDocument && (await chrome.offscreen.hasDocument())) {
    return;
  }

  creatingOffscreen = (async () => {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: [chrome.offscreen.Reason.BLOBS, chrome.offscreen.Reason.DOM_PARSER],
      justification:
        'Perform client-side canvas image conversions and stitch full-page screenshot slices',
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
  })();

  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function downloadConvertedFile(result: {
  blobUrl?: string;
  dataUrl?: string;
  filename: string;
}): Promise<void> {
  const urls = [result.dataUrl, result.blobUrl].filter(
    (url): url is string => typeof url === 'string' && url.length > 0
  );

  let lastError: unknown;
  for (const url of urls) {
    try {
      const downloadId = await chrome.downloads.download({
        url,
        filename: result.filename,
        saveAs: false,
      });
      if (downloadId !== undefined) return;
      lastError = new Error('Download failed');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Download failed');
}

async function showActionOk(): Promise<void> {
  await chrome.action.setBadgeText({ text: 'OK' });
  await chrome.action.setBadgeBackgroundColor({ color: '#059669' });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2000);
}

async function showActionError(): Promise<void> {
  await chrome.action.setBadgeText({ text: 'ERR' });
  await chrome.action.setBadgeBackgroundColor({ color: '#e11d48' });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 4000);
}
