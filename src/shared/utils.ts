import { ConversionOptions, ImageFormat, ImageFormatOption } from './types';

export const FORMAT_OPTIONS: ImageFormatOption[] = [
  {
    id: 'webp',
    label: 'WebP',
    mimeType: 'image/webp',
    extension: 'webp',
    supportsQuality: true,
    description: 'Modern web standard. Exceptional compression and quality.',
    badge: 'Recommended',
  },
  {
    id: 'jpeg',
    label: 'JPG / JPEG',
    mimeType: 'image/jpeg',
    extension: 'jpg',
    supportsQuality: true,
    description: 'Universal compatibility for photos and complex scenes.',
  },
  {
    id: 'png',
    label: 'PNG',
    mimeType: 'image/png',
    extension: 'png',
    supportsQuality: false,
    description: 'Lossless quality with full transparency support.',
  },
  {
    id: 'avif',
    label: 'AVIF',
    mimeType: 'image/avif',
    extension: 'avif',
    supportsQuality: true,
    description: 'Next-gen format with highest compression ratio.',
    badge: 'Next-Gen',
  },
  {
    id: 'bmp',
    label: 'BMP',
    mimeType: 'image/bmp',
    extension: 'bmp',
    supportsQuality: false,
    description: 'Uncompressed raster bitmap format.',
  },
  {
    id: 'ico',
    label: 'ICO (Favicon)',
    mimeType: 'image/x-icon',
    extension: 'ico',
    supportsQuality: false,
    description: 'Standard multi-size browser favicon format.',
  },
];

export function getFormatOption(format: ImageFormat): ImageFormatOption {
  return FORMAT_OPTIONS.find((f) => f.id === format) || FORMAT_OPTIONS[0];
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function calculateSavings(originalSize: number, newSize: number): {
  percentage: number;
  isReduction: boolean;
  formatted: string;
} {
  if (!originalSize || originalSize === 0) {
    return { percentage: 0, isReduction: false, formatted: '0%' };
  }
  const diff = originalSize - newSize;
  const percentage = (diff / originalSize) * 100;
  const isReduction = diff >= 0;
  const formatted = `${isReduction ? '-' : '+'}${Math.abs(percentage).toFixed(1)}%`;
  return { percentage, isReduction, formatted };
}

export function areConversionOptionsEqual(
  a: ConversionOptions,
  b: ConversionOptions
): boolean {
  return (
    a.format === b.format &&
    a.quality === b.quality &&
    a.scale === b.scale &&
    a.width === b.width &&
    a.height === b.height &&
    a.keepAspectRatio === b.keepAspectRatio &&
    (a.backgroundColor ?? 'transparent') === (b.backgroundColor ?? 'transparent') &&
    (a.filenamePattern ?? '{name}-converted.{ext}') ===
      (b.filenamePattern ?? '{name}-converted.{ext}') &&
    !!a.filters?.grayscale === !!b.filters?.grayscale &&
    !!a.filters?.invert === !!b.filters?.invert &&
    (a.filters?.brightness ?? 100) === (b.filters?.brightness ?? 100) &&
    (a.filters?.contrast ?? 100) === (b.filters?.contrast ?? 100)
  );
}

export function extractBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename;
  return filename.substring(0, lastDot);
}

export function generateOutputFilename(
  originalFilename: string,
  targetFormat: ImageFormat,
  pattern: string = '{name}-converted.{ext}',
  width?: number,
  height?: number
): string {
  const baseName = extractBaseName(originalFilename);
  const ext = getFormatOption(targetFormat).extension;
  let result = pattern
    .replace('{name}', baseName)
    .replace('{ext}', ext)
    .replace('{format}', targetFormat)
    .replace('{width}', width ? String(width) : '')
    .replace('{height}', height ? String(height) : '');

  if (!result.endsWith(`.${ext}`)) {
    result = `${result}.${ext}`;
  }
  return result;
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = url;
  });
}

export function createUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Creates an ICO file buffer from a PNG blob/canvas for ICO conversion
 */
export async function createIcoBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  // ICO header structure (6 bytes) + 1 directory entry (16 bytes) + PNG data
  const pngBlob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
  const pngBuffer = await pngBlob.arrayBuffer();
  const pngBytes = new Uint8Array(pngBuffer);

  const width = Math.min(canvas.width, 256);
  const height = Math.min(canvas.height, 256);

  const header = new Uint8Array([0, 0, 1, 0, 1, 0]); // Reserved, Type 1 (ICO), 1 image
  const dirEntry = new Uint8Array(16);
  const view = new DataView(dirEntry.buffer);

  view.setUint8(0, width >= 256 ? 0 : width);
  view.setUint8(1, height >= 256 ? 0 : height);
  view.setUint8(2, 0); // Palette
  view.setUint8(3, 0); // Reserved
  view.setUint16(4, 1, true); // Color planes
  view.setUint16(6, 32, true); // Bits per pixel
  view.setUint32(8, pngBytes.length, true); // Image byte size
  view.setUint32(12, 22, true); // Offset of image data (6 + 16 = 22)

  const icoBuffer = new Uint8Array(header.length + dirEntry.length + pngBytes.length);
  icoBuffer.set(header, 0);
  icoBuffer.set(dirEntry, header.length);
  icoBuffer.set(pngBytes, header.length + dirEntry.length);

  return new Blob([icoBuffer], { type: 'image/x-icon' });
}
