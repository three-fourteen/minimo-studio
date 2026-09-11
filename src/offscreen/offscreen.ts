import { convertImage } from '../shared/converter';
import { ImageFormat } from '../shared/types';
import { blobToDataURL, extractBaseName, getFormatOption } from '../shared/utils';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'OFFSCREEN_CONVERT') return;

  (async () => {
    try {
      const result = await handleOffscreenConvert(message.payload);
      sendResponse({ success: true, result });
    } catch (err) {
      console.error('Offscreen conversion error:', err);
      const error = err instanceof Error ? err.message : 'Conversion failed';
      sendResponse({ success: false, error });
    }
  })();

  return true;
});

async function handleOffscreenConvert(payload: {
  srcUrl: string;
  format: ImageFormat;
  quality?: number;
}): Promise<{ blobUrl: string; dataUrl: string; filename: string; size: number }> {
  const { srcUrl, format, quality = 0.85 } = payload;

  let sourceBlob: Blob | HTMLImageElement;
  let originalName = 'web_image';

  try {
    const urlObj = new URL(srcUrl);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      originalName = sanitizeDownloadBasename(extractBaseName(last)) || 'web_image';
    }
  } catch {
    originalName = 'web_image';
  }

  try {
    const response = await fetch(srcUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image (${response.status})`);
    }
    sourceBlob = await response.blob();
  } catch {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.src = srcUrl;
    });
    sourceBlob = img;
  }

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
  const blobUrl = URL.createObjectURL(result.blob);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

  return {
    blobUrl,
    dataUrl: await blobToDataURL(result.blob),
    filename,
    size: result.size,
  };
}

function sanitizeDownloadBasename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/^\.+/u, '_')
    .trim();
  return cleaned || 'web_image';
}
