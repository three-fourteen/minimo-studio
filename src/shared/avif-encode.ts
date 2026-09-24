/**
 * Canvas cannot encode AVIF in Chromium — toBlob('image/avif') silently
 * returns PNG. Encode via libavif WASM (single-thread; no SharedArrayBuffer).
 */
import { defaultOptions } from '@jsquash/avif/meta';
import { initEmscriptenModule } from '@jsquash/avif/utils';
import wasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';

type AvifEncoderModule = {
  encode: (
    data: BufferSource,
    width: number,
    height: number,
    options: typeof defaultOptions
  ) => Uint8Array | null;
};

let modulePromise: Promise<AvifEncoderModule> | null = null;

async function getAvifModule(): Promise<AvifEncoderModule> {
  if (!modulePromise) {
    modulePromise = import('@jsquash/avif/codec/enc/avif_enc.js').then(
      (avifEncoder) =>
        initEmscriptenModule(avifEncoder.default, undefined, {
          locateFile: (path: string, prefix: string) => {
            if (path.endsWith('.wasm')) return wasmUrl;
            return prefix + path;
          },
        }) as Promise<AvifEncoderModule>
    );
  }
  return modulePromise;
}

export async function encodeAvifBlob(
  imageData: ImageData,
  quality01: number
): Promise<Blob> {
  const module = await getAvifModule();
  const quality = Math.round(Math.max(0, Math.min(100, quality01 * 100)));
  const options = {
    ...defaultOptions,
    quality,
  };

  const output = module.encode(
    new Uint8Array(
      imageData.data.buffer,
      imageData.data.byteOffset,
      imageData.data.byteLength
    ),
    imageData.width,
    imageData.height,
    options
  );

  if (!output) {
    throw new Error('AVIF encoding failed');
  }

  // Copy out of the wasm heap view so Blob gets a plain ArrayBuffer.
  const bytes = new Uint8Array(output.byteLength);
  bytes.set(output);
  return new Blob([bytes], { type: 'image/avif' });
}
