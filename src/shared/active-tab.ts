export async function getLastFocusedNormalTab(): Promise<chrome.tabs.Tab | undefined> {
  if (typeof chrome === 'undefined') return undefined;

  if (chrome.windows?.getLastFocused) {
    try {
      const win = await chrome.windows.getLastFocused({
        populate: true,
        windowTypes: ['normal'],
      });
      return win.tabs?.find((tab) => tab.active) ?? win.tabs?.[0];
    } catch {
      // Fall through to tabs.query.
    }
  }

  if (!chrome.tabs?.query) return undefined;
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused) return focused;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  return active;
}
