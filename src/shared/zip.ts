import JSZip from 'jszip';
import { ConversionResult } from './types';

export async function createBatchZip(
  results: ConversionResult[]
): Promise<Blob> {
  const zip = new JSZip();

  // Keep track of duplicate filenames inside ZIP
  const usedNames = new Map<string, number>();

  for (const result of results) {
    let filename = result.filename;
    if (usedNames.has(filename)) {
      const count = usedNames.get(filename)! + 1;
      usedNames.set(filename, count);
      const dot = filename.lastIndexOf('.');
      if (dot !== -1) {
        filename = `${filename.substring(0, dot)}_${count}${filename.substring(dot)}`;
      } else {
        filename = `${filename}_${count}`;
      }
    } else {
      usedNames.set(filename, 1);
    }

    zip.file(filename, result.blob);
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: false,
      },
      () => {
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    );
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
