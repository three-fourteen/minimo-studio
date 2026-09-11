import { convertImage } from '../shared/converter';
import { ImageFormat } from '../shared/types';
import { extractBaseName, getFormatOption } from '../shared/utils';

// Listen for conversion requests from Service Worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_CONVERT') {
    handleOffscreenConvert(message.payload)
      .then((res) => sendResponse({ success: true, result: res }))
      .catch((err) => {
        console.error('Offscreen conversion error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }
});

async function handleOffscreenConvert(payload: {
  srcUrl: string;
  format: ImageFormat;
  quality?: number;
}): Promise<{ dataUrl: string; filename: string; size: number }> {
  const { srcUrl, format, quality = 0.85 } = payload;

  let sourceBlob: Blob | HTMLImageElement;
  let originalName = 'web_image';

  // Extract clean filename from URL if possible
  try {
    const urlObj = new URL(srcUrl);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      originalName = extractBaseName(last) || 'web_image';
    }
  } catch {
    originalName = 'web_image';
  }

  // 1. Fetch image resource (or fallback to Image element)
  try {
    const response = await fetch(srcUrl);
    sourceBlob = await response.blob();
  } catch {
    // Fallback if fetch fails (e.g. data URL or cross-origin canvas load)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(new Error('Failed to load image element: ' + e));
      img.src = srcUrl;
    });
    sourceBlob = img;
  }

  // 2. Perform conversion
  const result = await convertImage(
    sourceBlob,
    {
      format,
      quality,
      keepAspectRatio: true,
    },
    originalName,
    sourceBlob instanceof Blob ? sourceBlob.size : 0
  );

  const ext = getFormatOption(format).extension;
  const filename = `${originalName}.${ext}`;

  // Return dataUrl to Service Worker so Service Worker can invoke chrome.downloads
  return {
    dataUrl: result.dataUrl,
    filename: filename,
    size: result.size,
  };
}
