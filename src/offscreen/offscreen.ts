import { convertImage } from '../shared/converter';
import {
  ImageFormat,
  MAX_CANVAS_DIMENSION,
  PendingScreenshot,
  StitchPayload,
} from '../shared/types';
import { blobToDataURL, extractBaseName, getFormatOption, loadImageFromUrl } from '../shared/utils';

let pendingCapture: PendingScreenshot | null = null;

type OffscreenMessageType = 'OFFSCREEN_CONVERT' | 'OFFSCREEN_STITCH' | 'OFFSCREEN_CLAIM_SCREENSHOT';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message?.type as string | undefined;

  if (
    type !== 'OFFSCREEN_CONVERT' &&
    type !== 'OFFSCREEN_STITCH' &&
    type !== 'OFFSCREEN_CLAIM_SCREENSHOT'
  ) {
    return;
  }

  const offscreenType: OffscreenMessageType = type;

  (async () => {
    try {
      switch (offscreenType) {
        case 'OFFSCREEN_CONVERT': {
          const result = await handleOffscreenConvert(message.payload);
          sendResponse({ success: true, result });
          break;
        }
        case 'OFFSCREEN_STITCH': {
          const result = await handleOffscreenStitch(message.payload as StitchPayload);
          pendingCapture = result;
          sendResponse({ success: true, result });
          break;
        }
        case 'OFFSCREEN_CLAIM_SCREENSHOT': {
          const pending = pendingCapture;
          pendingCapture = null;
          sendResponse({ success: true, result: pending });
          break;
        }
        default: {
          const _exhaustive: never = offscreenType;
          sendResponse({ success: false, error: `Unhandled message: ${_exhaustive}` });
        }
      }
    } catch (err) {
      console.error('Offscreen error:', err);
      const error = err instanceof Error ? err.message : 'Offscreen task failed';
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

async function handleOffscreenStitch(
  payload: StitchPayload
): Promise<PendingScreenshot> {
  const { slices, pageHeight, dpr, filename } = payload;
  if (!slices?.length) {
    throw new Error('No slices to stitch');
  }

  const images = [];
  for (const slice of slices) {
    images.push(await loadImageFromUrl(slice.dataUrl));
  }

  const pixelRatio = dpr || 1;
  const width = images[0].naturalWidth || images[0].width;
  const last = slices[slices.length - 1];
  const lastImg = images[images.length - 1];
  const height = Math.max(
    Math.round(pageHeight * pixelRatio),
    Math.round(last.y * pixelRatio) + (lastImg.naturalHeight || lastImg.height)
  );

  let scale = 1;
  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) {
    scale = Math.min(MAX_CANVAS_DIMENSION / width, MAX_CANVAS_DIMENSION / height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not obtain 2D canvas context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, slices[i].y * pixelRatio * scale, srcW * scale, srcH * scale);
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    filename: filename || 'page-screenshot.png',
  };
}

function sanitizeDownloadBasename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/^\.+/u, '_')
    .trim();
  return cleaned || 'web_image';
}
