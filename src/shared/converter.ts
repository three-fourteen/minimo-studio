import { ConversionOptions, ConversionResult, ImageFormat } from './types';
import {
  calculateSavings,
  createIcoBlob,
  generateOutputFilename,
  getFormatOption,
} from './utils';

/**
 * Checks if the current browser environment supports encoding to a given MIME type
 */
export function isFormatEncodingSupported(format: ImageFormat): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const mimeType = getFormatOption(format).mimeType;
  const dataUrl = canvas.toDataURL(mimeType);
  return dataUrl.startsWith(`data:${mimeType}`);
}

/**
 * Calculates output dimensions based on scaling options
 */
export function calculateTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  options: ConversionOptions
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  if (options.scale && options.scale > 0 && options.scale !== 1) {
    width = Math.round(originalWidth * options.scale);
    height = Math.round(originalHeight * options.scale);
  } else if (options.width || options.height) {
    if (options.keepAspectRatio) {
      if (options.width && options.height) {
        const ratio = Math.min(
          options.width / originalWidth,
          options.height / originalHeight
        );
        width = Math.round(originalWidth * ratio);
        height = Math.round(originalHeight * ratio);
      } else if (options.width) {
        width = options.width;
        height = Math.round((options.width / originalWidth) * originalHeight);
      } else if (options.height) {
        height = options.height;
        width = Math.round((options.height / originalHeight) * originalWidth);
      }
    } else {
      if (options.width) width = options.width;
      if (options.height) height = options.height;
    }
  }

  // Ensure dimensions are at least 1px
  width = Math.max(1, width);
  height = Math.max(1, height);

  return { width, height };
}

function formatRequiresOpaqueBackground(format: ImageFormat): boolean {
  switch (format) {
    case 'jpeg':
    case 'bmp':
      return true;
    case 'png':
    case 'webp':
    case 'avif':
    case 'ico':
      return false;
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}

function resolveBackgroundFill(
  format: ImageFormat,
  backgroundColor?: string
): string | null {
  const customFill =
    backgroundColor && backgroundColor !== 'transparent' ? backgroundColor : null;
  if (customFill) return customFill;
  if (formatRequiresOpaqueBackground(format)) return '#ffffff';
  return null;
}

/**
 * Core image converter function: transforms any input image to desired format & settings
 */
export async function convertImage(
  source: Blob | HTMLImageElement | ImageBitmap,
  options: ConversionOptions,
  originalFilename: string = 'image.png',
  originalFileSize: number = 0
): Promise<ConversionResult> {
  let imgBitmap: ImageBitmap | HTMLImageElement;
  let originalWidth = 0;
  let originalHeight = 0;

  if (source instanceof Blob) {
    try {
      imgBitmap = await createImageBitmap(source);
      originalWidth = imgBitmap.width;
      originalHeight = imgBitmap.height;
      if (originalFileSize === 0) {
        originalFileSize = source.size;
      }
    } catch {
      // Fallback for SVGs or formats createImageBitmap might fail on
      const img = new Image();
      const objectUrl = URL.createObjectURL(source);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to decode image'));
        };
        img.src = objectUrl;
      });
      imgBitmap = img;
      originalWidth = img.naturalWidth || img.width;
      originalHeight = img.naturalHeight || img.height;
      if (originalFileSize === 0) originalFileSize = source.size;
    }
  } else if (source instanceof HTMLImageElement) {
    imgBitmap = source;
    originalWidth = source.naturalWidth || source.width;
    originalHeight = source.naturalHeight || source.height;
  } else {
    imgBitmap = source;
    originalWidth = source.width;
    originalHeight = source.height;
  }

  const { width, height } = calculateTargetDimensions(
    originalWidth,
    originalHeight,
    options
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Could not obtain 2D canvas context');
  }

  // High quality interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const fillColor = resolveBackgroundFill(options.format, options.backgroundColor);
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, width, height);
  }

  const filterParts: string[] = [];
  if (options.filters) {
    if (options.filters.grayscale) filterParts.push('grayscale(100%)');
    if (options.filters.invert) filterParts.push('invert(100%)');
    if (
      options.filters.brightness !== undefined &&
      options.filters.brightness !== 100
    ) {
      filterParts.push(`brightness(${options.filters.brightness}%)`);
    }
    if (
      options.filters.contrast !== undefined &&
      options.filters.contrast !== 100
    ) {
      filterParts.push(`contrast(${options.filters.contrast}%)`);
    }
  }
  if (filterParts.length > 0) {
    ctx.filter = filterParts.join(' ');
  }

  ctx.drawImage(imgBitmap, 0, 0, width, height);

  // Clean up ImageBitmap memory if applicable
  if ('close' in imgBitmap && typeof imgBitmap.close === 'function') {
    imgBitmap.close();
  }

  let outputBlob: Blob;
  const formatOpt = getFormatOption(options.format);
  const mimeType = formatOpt.mimeType;

  if (options.format === 'ico') {
    outputBlob = await createIcoBlob(canvas);
  } else {
    // Quality clamping between 0.01 and 1.0
    const quality = Math.max(0.01, Math.min(1.0, options.quality || 0.85));

    outputBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(
              new Error(`Failed to encode canvas to format: ${options.format}`)
            );
          }
        },
        mimeType,
        formatOpt.supportsQuality ? quality : undefined
      );
    });
  }

  const outputDataUrl = canvas.toDataURL(mimeType, options.quality);
  const outputSize = outputBlob.size;
  const filename = generateOutputFilename(
    originalFilename,
    options.format,
    options.filenamePattern || '{name}-converted.{ext}',
    width,
    height
  );

  const savings = calculateSavings(originalFileSize, outputSize);

  return {
    blob: outputBlob,
    dataUrl: outputDataUrl,
    size: outputSize,
    width,
    height,
    format: options.format,
    mimeType,
    filename,
    savingsPercentage: savings.percentage,
  };
}
