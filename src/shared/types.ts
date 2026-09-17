export type ImageFormat = 'webp' | 'jpeg' | 'png' | 'avif' | 'bmp' | 'ico';

export const MAX_CANVAS_DIMENSION = 16384;

export interface ImageFormatOption {
  id: ImageFormat;
  label: string;
  mimeType: string;
  extension: string;
  supportsQuality: boolean;
  description: string;
  badge?: string;
}

export interface ConversionOptions {
  format: ImageFormat;
  quality: number; // 0.01 - 1.0 (e.g. 0.85 = 85%)
  scale?: number; // 0.25, 0.5, 0.75, 1.0, 1.5, 2.0
  width?: number;
  height?: number;
  keepAspectRatio: boolean;
  backgroundColor?: string; // Hex or 'transparent' (default #ffffff for JPEG/BMP)
  filters?: {
    grayscale?: boolean;
    invert?: boolean;
    brightness?: number; // 50 - 150 (100 = default)
    contrast?: number; // 50 - 150 (100 = default)
  };
  filenamePattern?: string; // e.g. "{name}-converted.{ext}"
}

export interface ConversionResult {
  blob: Blob;
  dataUrl: string;
  size: number;
  width: number;
  height: number;
  format: ImageFormat;
  mimeType: string;
  filename: string;
  savingsPercentage: number; // e.g. -45.5%
}

export type ConversionStatus = 'idle' | 'processing' | 'completed' | 'error';

export interface QueueItem {
  id: string;
  name: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  originalType: string;
  originalDataUrl: string;
  originalBlob: Blob;
  options: ConversionOptions;
  status: ConversionStatus;
  result?: ConversionResult;
  error?: string;
  timestamp: number;
}

export interface CaptureSlice {
  dataUrl: string;
  y: number;
}

export interface StitchPayload {
  slices: CaptureSlice[];
  viewportHeight: number;
  pageHeight: number;
  dpr: number;
  filename: string;
}

export interface PendingScreenshot {
  dataUrl: string;
  filename: string;
}

export interface ExtensionMessage {
  type:
    | 'CONVERT_IMAGE_URL'
    | 'CONVERT_RESULT'
    | 'SEND_TO_SIDEPANEL'
    | 'OPEN_SIDEPANEL'
    | 'PING'
    | 'CAPTURE_FULL_PAGE'
    | 'SCREENSHOT_READY'
    | 'OFFSCREEN_STITCH'
    | 'OFFSCREEN_CONVERT'
    | 'OFFSCREEN_CLAIM_SCREENSHOT';
  payload?: any;
}
