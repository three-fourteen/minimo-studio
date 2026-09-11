import { ImageFormat } from '../shared/types';

// Context Menu IDs
const MENU_PARENT = 'opticonvert-parent';
const MENU_CONVERT_WEBP = 'opticonvert-webp';
const MENU_CONVERT_PNG = 'opticonvert-png';
const MENU_CONVERT_JPG = 'opticonvert-jpg';
const MENU_CONVERT_AVIF = 'opticonvert-avif';
const MENU_OPEN_SIDEPANEL = 'opticonvert-open-sidepanel';

// Install / Update Event
chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

// Also re-create context menus on startup
chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

function createContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    // Parent Menu
    chrome.contextMenus.create({
      id: MENU_PARENT,
      title: 'Minimo Image',
      contexts: ['image'],
    });

    // Submenu Items
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

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.srcUrl) return;

  const srcUrl = info.srcUrl;

  // Open in Side Panel
  if (info.menuItemId === MENU_OPEN_SIDEPANEL) {
    try {
      await chrome.storage.local.set({ pendingContextMenuImage: srcUrl });

      if (typeof chrome.sidePanel?.open === 'function') {
        if (tab?.id) {
          await chrome.sidePanel.open({ tabId: tab.id });
        } else if (tab?.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
      }

      chrome.runtime.sendMessage({
        type: 'SEND_TO_SIDEPANEL',
        payload: { srcUrl },
      }).catch(() => {
        // Ignored if sidepanel is not open yet (storage will handle it)
      });
    } catch (err) {
      console.error('Error opening side panel:', err);
    }
    return;
  }

  // Direct Format Conversions & Download
  let targetFormat: ImageFormat | null = null;
  if (info.menuItemId === MENU_CONVERT_WEBP) targetFormat = 'webp';
  else if (info.menuItemId === MENU_CONVERT_PNG) targetFormat = 'png';
  else if (info.menuItemId === MENU_CONVERT_JPG) targetFormat = 'jpeg';
  else if (info.menuItemId === MENU_CONVERT_AVIF) targetFormat = 'avif';

  if (targetFormat) {
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

      if (response && response.success && response.result?.dataUrl) {
        await chrome.downloads.download({
          url: response.result.dataUrl,
          filename: response.result.filename,
          saveAs: false,
        });
      } else {
        console.error('Offscreen conversion failed:', response?.error);
      }
    } catch (err) {
      console.error('Failed to convert and download image via offscreen document:', err);
    }
  }
});

// Offscreen Document Management
let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');

  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: [chrome.offscreen.Reason.BLOBS, chrome.offscreen.Reason.DOM_PARSER],
    justification: 'Perform client-side canvas image conversions from context menu',
  });

  await creatingOffscreen;
  creatingOffscreen = null;
  // Brief tick to ensure offscreen message listener is ready
  await new Promise((resolve) => setTimeout(resolve, 80));
}
