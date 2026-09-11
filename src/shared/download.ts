export async function triggerBlobDownload(blob: Blob, filename: string): Promise<void> {
  const { url, revoke } = await blobToDownloadUrl(blob);

  try {
    if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
      const downloadId = await chrome.downloads.download({
        url,
        filename,
        saveAs: false,
      });
      if (downloadId === undefined) {
        throw new Error('Download failed');
      }
      return;
    }

    if (typeof document === 'undefined') {
      throw new Error('Downloads API unavailable');
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    if (revoke) {
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }
}

async function blobToDownloadUrl(blob: Blob): Promise<{ url: string; revoke: boolean }> {
  if (!(blob instanceof Blob)) {
    throw new Error('Download source is not a Blob');
  }

  if (typeof URL.createObjectURL === 'function') {
    return { url: URL.createObjectURL(blob), revoke: true };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });

  return { url: dataUrl, revoke: false };
}
