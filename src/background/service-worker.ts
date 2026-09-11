import { ImageFormat } from '../shared/types';

const MENU_PARENT = 'opticonvert-parent';
const MENU_CONVERT_WEBP = 'opticonvert-webp';
const MENU_CONVERT_PNG = 'opticonvert-png';
const MENU_CONVERT_JPG = 'opticonvert-jpg';
const MENU_CONVERT_AVIF = 'opticonvert-avif';
const MENU_OPEN_SIDEPANEL = 'opticonvert-open-sidepanel';

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

function createContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
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

function openSidePanelFromTab(tab?: chrome.tabs.Tab): Promise<void> {
  if (typeof chrome.sidePanel?.open !== 'function') {
    return Promise.resolve();
  }
  if (tab?.id != null) {
    return chrome.sidePanel.open({ tabId: tab.id });
  }
  if (tab?.windowId != null) {
    return chrome.sidePanel.open({ windowId: tab.windowId });
  }
  return Promise.resolve();
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.srcUrl) return;

  const srcUrl = info.srcUrl;

  if (info.menuItemId === MENU_OPEN_SIDEPANEL) {
    // sidePanel.open() must run in this turn — any prior await drops the user gesture.
    const openPromise = openSidePanelFromTab(tab);

    try {
      await chrome.storage.local.set({ pendingContextMenuImage: srcUrl });
      await openPromise;
    } catch (err) {
      console.error('Error opening side panel:', err);
      await showActionError();
    }
    return;
  }

  let targetFormat: ImageFormat | null = null;
  if (info.menuItemId === MENU_CONVERT_WEBP) targetFormat = 'webp';
  else if (info.menuItemId === MENU_CONVERT_PNG) targetFormat = 'png';
  else if (info.menuItemId === MENU_CONVERT_JPG) targetFormat = 'jpeg';
  else if (info.menuItemId === MENU_CONVERT_AVIF) targetFormat = 'avif';

  if (!targetFormat) return;

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
});

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
      justification: 'Perform client-side canvas image conversions from context menu',
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
  // sendMessage JSON-serializes — only URL strings survive. Prefer data: (works from SW);
  // blob: from the still-open offscreen doc is the large-file fallback.
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
