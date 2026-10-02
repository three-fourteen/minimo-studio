export async function requestFullPageCapture(
  button: HTMLButtonElement,
  tabId?: number
): Promise<void> {
  if (typeof chrome === 'undefined' || typeof chrome.runtime?.sendMessage !== 'function') {
    return;
  }

  const capturePromise = chrome.runtime.sendMessage({
    type: 'CAPTURE_FULL_PAGE',
    tabId,
  });

  button.disabled = true;
  try {
    const response = await capturePromise;
    if (!response?.success) {
      console.error('Full page capture failed:', response?.error);
    }
  } catch (err) {
    console.error('Full page capture failed:', err);
  } finally {
    button.disabled = false;
  }
}

export async function claimPendingScreenshot(
  importFromPayload: (payload: { srcUrl: string; filename?: string }) => Promise<void>
): Promise<void> {
  if (typeof chrome === 'undefined' || typeof chrome.runtime?.sendMessage !== 'function') {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_CLAIM_SCREENSHOT' });
    const result = response?.result as { dataUrl?: string; filename?: string } | null | undefined;
    if (!result?.dataUrl) return;
    if (chrome.action?.setBadgeText) {
      void chrome.action.setBadgeText({ text: '' });
    }
    await importFromPayload({ srcUrl: result.dataUrl, filename: result.filename });
  } catch (err) {
    console.error('Failed to claim screenshot:', err);
  }
}
