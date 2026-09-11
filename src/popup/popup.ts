import { convertImage } from '../shared/converter';
import { initTheme } from '../shared/theme';
import { ConversionOptions, ImageFormat, QueueItem } from '../shared/types';
import {
  blobToDataURL,
  calculateSavings,
  createUniqueId,
  FORMAT_OPTIONS,
  formatBytes,
  getFormatOption,
} from '../shared/utils';
import { createBatchZip, triggerBlobDownload } from '../shared/zip';

// State
let selectedFormat: ImageFormat = 'webp';
let quality: number = 0.85;
let scale: number = 1.0;
let queue: QueueItem[] = [];
let isProcessing: boolean = false;
const selectedItemIds = new Set<string>();

// DOM Elements
const formatGrid = document.getElementById('format-grid') as HTMLDivElement;
const dropzone = document.getElementById('dropzone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const qualityContainer = document.getElementById('quality-container') as HTMLDivElement;
const qualitySlider = document.getElementById('quality-slider') as HTMLInputElement;
const qualityVal = document.getElementById('quality-val') as HTMLSpanElement;
const scaleControl = document.getElementById('scale-control') as HTMLDivElement;
const previewContainer = document.getElementById('preview-container') as HTMLDivElement;
const popupQueueHeader = document.getElementById('popup-queue-header') as HTMLDivElement;
const chkSelectAllPopup = document.getElementById('chk-select-all-popup') as HTMLInputElement;
const popupSelectionBadge = document.getElementById('popup-selection-badge') as HTMLSpanElement;
const previewList = document.getElementById('preview-list') as HTMLDivElement;
const popupFooter = document.getElementById('popup-footer') as HTMLElement;
const btnDownloadAll = document.getElementById('btn-download-all') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnOpenSidepanel = document.getElementById('btn-open-sidepanel') as HTMLButtonElement;
const downloadBtnText = document.getElementById('download-btn-text') as HTMLSpanElement;
const btnThemeToggle = document.getElementById('btn-theme-toggle') as HTMLElement;

// Initialize
function init(): void {
  initTheme(btnThemeToggle);
  renderFormatButtons();
  setupEventListeners();
  updateQualityVisibility();
  loadSavedSettings();
}

function renderFormatButtons(): void {
  formatGrid.innerHTML = '';
  FORMAT_OPTIONS.forEach((opt) => {
    const pill = document.createElement('div');
    pill.className = `format-pill ${opt.id === selectedFormat ? 'active' : ''}`;
    pill.dataset.format = opt.id;

    let badgeHtml = '';
    if (opt.badge) {
      badgeHtml = `<span class="format-pill-badge">${opt.badge}</span>`;
    }

    pill.innerHTML = `
      ${badgeHtml}
      <div class="format-pill-name">${opt.label}</div>
    `;

    pill.addEventListener('click', () => {
      if (selectedFormat === opt.id) return;
      selectedFormat = opt.id;
      document
        .querySelectorAll('.format-pill')
        .forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      updateQualityVisibility();
      saveSettings();
      reprocessQueue();
    });

    formatGrid.appendChild(pill);
  });
}

function updateQualityVisibility(): void {
  const formatOpt = getFormatOption(selectedFormat);
  if (formatOpt.supportsQuality) {
    qualityContainer.style.display = 'flex';
  } else {
    qualityContainer.style.display = 'none';
  }
}

function setupEventListeners(): void {
  // Dropzone click
  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
    fileInput.value = '';
  });

  // Drag & Drop
  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFiles(Array.from(dt.files));
    }
  });

  // Clipboard Paste
  window.addEventListener('paste', (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const namedFile = new File(
            [file],
            `clipboard_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
            { type: file.type }
          );
          files.push(namedFile);
        }
      }
    }
    if (files.length > 0) {
      handleFiles(files);
    }
  });

  // Quality slider
  let qualityDebounce: ReturnType<typeof setTimeout>;
  qualitySlider.addEventListener('input', () => {
    const val = parseInt(qualitySlider.value, 10);
    quality = val / 100;
    qualityVal.textContent = `${val}%`;
    clearTimeout(qualityDebounce);
    qualityDebounce = setTimeout(() => {
      saveSettings();
      reprocessQueue();
    }, 200);
  });

  // Scale buttons
  scaleControl.querySelectorAll('.segmented-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      scaleControl
        .querySelectorAll('.segmented-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      scale = parseFloat((btn as HTMLElement).dataset.scale || '1');
      saveSettings();
      reprocessQueue();
    });
  });

  // Action Buttons
  btnClear.addEventListener('click', clearQueue);
  btnDownloadAll.addEventListener('click', downloadAll);

  // Master Select All / Deselect All
  if (chkSelectAllPopup) {
    chkSelectAllPopup.addEventListener('change', () => {
      if (chkSelectAllPopup.checked) {
        queue.forEach((q) => selectedItemIds.add(q.id));
      } else {
        selectedItemIds.clear();
      }
      renderQueueList();
      updateSelectionUI();
    });
  }

  // Side Panel Launcher
  btnOpenSidepanel.addEventListener('click', async () => {
    if (typeof chrome !== 'undefined' && typeof chrome.sidePanel?.open === 'function') {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          // If we have items in queue, pass them to side panel via storage
          if (queue.length > 0) {
            await chrome.storage.local.set({
              pendingQueue: queue.map((q) => ({
                id: q.id,
                name: q.name,
                originalDataUrl: q.originalDataUrl,
                originalSize: q.originalSize,
                originalType: q.originalType,
                originalWidth: q.originalWidth,
                originalHeight: q.originalHeight,
              })),
            });
          }
          await chrome.sidePanel.open({ tabId: tab.id });
          window.close();
        }
      } catch (err) {
        console.error('Failed to open side panel:', err);
      }
    }
  });
}

async function handleFiles(files: File[]): Promise<void> {
  const imageFiles = files.filter((f) => f.type.startsWith('image/') || f.name.match(/\.(jpe?g|png|webp|avif|bmp|gif|svg|tiff?|ico)$/i));
  if (imageFiles.length === 0) return;

  for (const file of imageFiles) {
    try {
      const dataUrl = await blobToDataURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      const options: ConversionOptions = {
        format: selectedFormat,
        quality: quality,
        scale: scale,
        keepAspectRatio: true,
      };

      const item: QueueItem = {
        id: createUniqueId(),
        name: file.name,
        originalSize: file.size,
        originalWidth: img.naturalWidth || img.width,
        originalHeight: img.naturalHeight || img.height,
        originalType: file.type || 'image/png',
        originalDataUrl: dataUrl,
        originalBlob: file,
        options,
        status: 'idle',
        timestamp: Date.now(),
      };

      queue.push(item);
      selectedItemIds.add(item.id);
    } catch (err) {
      console.error('Error loading image file:', file.name, err);
    }
  }

  updateUI();
  processQueue();
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  for (const item of queue) {
    if (item.status === 'completed') continue;
    item.status = 'processing';
    updateQueueCard(item);

    try {
      item.options = {
        format: selectedFormat,
        quality: quality,
        scale: scale,
        keepAspectRatio: true,
      };

      const result = await convertImage(
        item.originalBlob,
        item.options,
        item.name,
        item.originalSize
      );

      item.result = result;
      item.status = 'completed';
    } catch (err: any) {
      console.error('Conversion failed for item:', item.name, err);
      item.status = 'error';
      item.error = err.message || 'Conversion error';
    }

    updateQueueCard(item);
    updateSelectionUI();
  }

  isProcessing = false;
  updateUI();
}

function reprocessQueue(): void {
  if (queue.length === 0) return;
  queue.forEach((item) => {
    item.status = 'idle';
  });
  processQueue();
}

function updateSelectionUI(): void {
  const totalCount = queue.length;
  const selectedCount = selectedItemIds.size;

  if (chkSelectAllPopup) {
    chkSelectAllPopup.checked = selectedCount === totalCount && totalCount > 0;
    chkSelectAllPopup.indeterminate = selectedCount > 0 && selectedCount < totalCount;
  }

  if (popupSelectionBadge) {
    popupSelectionBadge.textContent = `${selectedCount}/${totalCount} Selected`;
  }

  const completedSelected = queue.filter(
    (q) => selectedItemIds.has(q.id) && q.status === 'completed' && q.result
  );

  if (completedSelected.length === 0) {
    downloadBtnText.textContent = totalCount === 0 ? 'No images' : 'Select images to download';
    btnDownloadAll.disabled = true;
  } else if (completedSelected.length === 1) {
    downloadBtnText.textContent = `Download (${completedSelected[0].result!.filename})`;
    btnDownloadAll.disabled = false;
  } else if (completedSelected.length === totalCount) {
    downloadBtnText.textContent = `Download All (${completedSelected.length} Images as ZIP)`;
    btnDownloadAll.disabled = false;
  } else {
    downloadBtnText.textContent = `Download Selected (${completedSelected.length} of ${totalCount} as ZIP)`;
    btnDownloadAll.disabled = false;
  }
}

function updateUI(): void {
  if (queue.length === 0) {
    if (previewContainer) previewContainer.style.display = 'none';
    popupFooter.style.display = 'none';
    dropzone.style.display = 'block';
  } else {
    if (previewContainer) previewContainer.style.display = 'flex';
    if (popupQueueHeader) {
      popupQueueHeader.style.display = queue.length > 1 ? 'flex' : 'none';
    }
    popupFooter.style.display = 'flex';
    dropzone.style.display = 'block';

    renderQueueList();
    updateSelectionUI();
  }
}

function renderQueueList(): void {
  previewList.innerHTML = '';
  queue.forEach((item) => {
    const card = document.createElement('div');
    card.id = `card-${item.id}`;
    card.className = 'preview-card glass-panel';
    card.innerHTML = getCardHtml(item);
    attachCardEvents(card, item);
    previewList.appendChild(card);
  });
}

function updateQueueCard(item: QueueItem): void {
  const card = document.getElementById(`card-${item.id}`);
  if (card) {
    card.innerHTML = getCardHtml(item);
    attachCardEvents(card, item);
  }
}

function getCardHtml(item: QueueItem): string {
  const thumbUrl = item.result?.dataUrl || item.originalDataUrl;
  const isChecked = selectedItemIds.has(item.id);
  let statusHtml = '';

  if (item.status === 'processing') {
    statusHtml = `<span class="badge badge-primary">Converting...</span>`;
  } else if (item.status === 'error') {
    statusHtml = `<span class="badge badge-rose">Error</span>`;
  } else if (item.status === 'completed' && item.result) {
    const savings = calculateSavings(item.originalSize, item.result.size);
    const badgeClass = savings.isReduction ? 'badge-emerald' : 'badge-amber';
    statusHtml = `
      <div class="preview-sizes">
        <span class="size-orig">${formatBytes(item.originalSize)}</span>
        <span class="size-arrow">➔</span>
        <span class="size-conv">${formatBytes(item.result.size)}</span>
        <span class="badge ${badgeClass}">${savings.formatted}</span>
      </div>
    `;
  }

  return `
    <input type="checkbox" class="item-checkbox popup-item-chk" ${isChecked ? 'checked' : ''} title="Select for download" />
    <img src="${thumbUrl}" class="preview-thumb" alt="thumbnail" />
    <div class="preview-info">
      <div class="preview-name" title="${item.name}">${item.name}</div>
      ${statusHtml}
    </div>
    <div class="preview-actions">
      <button class="btn btn-icon btn-regen-item" title="Regenerate with current settings">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
      </button>
      ${
        item.status === 'completed' && item.result
          ? `<button class="btn btn-icon btn-download-item" title="Download Image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>`
          : ''
      }
      <button class="btn btn-icon btn-remove-item" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;
}

function attachCardEvents(card: HTMLElement, item: QueueItem): void {
  const chk = card.querySelector('.popup-item-chk') as HTMLInputElement;
  if (chk) {
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      if (chk.checked) {
        selectedItemIds.add(item.id);
      } else {
        selectedItemIds.delete(item.id);
      }
      updateSelectionUI();
    });
  }

  const btnRegen = card.querySelector('.btn-regen-item');
  if (btnRegen) {
    btnRegen.addEventListener('click', async (e) => {
      e.stopPropagation();
      item.status = 'processing';
      updateQueueCard(item);
      try {
        item.options = {
          format: selectedFormat,
          quality: quality,
          scale: scale,
          keepAspectRatio: true,
        };
        const result = await convertImage(
          item.originalBlob,
          item.options,
          item.name,
          item.originalSize
        );
        item.result = result;
        item.status = 'completed';
      } catch (err: any) {
        item.status = 'error';
        item.error = err.message || 'Conversion error';
      }
      updateQueueCard(item);
      updateSelectionUI();
    });
  }

  const btnDownload = card.querySelector('.btn-download-item');
  if (btnDownload && item.result) {
    btnDownload.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerBlobDownload(item.result!.blob, item.result!.filename);
    });
  }

  const btnRemove = card.querySelector('.btn-remove-item');
  if (btnRemove) {
    btnRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedItemIds.delete(item.id);
      queue = queue.filter((q) => q.id !== item.id);
      updateUI();
    });
  }
}

async function downloadAll(): Promise<void> {
  const selected = queue.filter(
    (q) => selectedItemIds.has(q.id) && q.status === 'completed' && q.result
  );
  if (selected.length === 0) return;

  if (selected.length === 1) {
    const res = selected[0].result!;
    triggerBlobDownload(res.blob, res.filename);
  } else {
    const results = selected.map((q) => q.result!);
    const zipBlob = await createBatchZip(results);
    triggerBlobDownload(zipBlob, `minimo_${Date.now()}.zip`);
  }
}

function clearQueue(): void {
  queue = [];
  selectedItemIds.clear();
  updateUI();
}

function saveSettings(): void {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      defaultFormat: selectedFormat,
      defaultQuality: quality,
      defaultScale: scale,
    });
  }
}

function loadSavedSettings(): void {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      ['defaultFormat', 'defaultQuality', 'defaultScale'],
      (res) => {
        if (res.defaultFormat) selectedFormat = res.defaultFormat;
        if (res.defaultQuality !== undefined) {
          quality = res.defaultQuality;
          qualitySlider.value = String(Math.round(quality * 100));
          qualityVal.textContent = `${Math.round(quality * 100)}%`;
        }
        if (res.defaultScale !== undefined) {
          scale = res.defaultScale;
          scaleControl.querySelectorAll('.segmented-btn').forEach((b) => {
            b.classList.toggle(
              'active',
              parseFloat((b as HTMLElement).dataset.scale || '1') === scale
            );
          });
        }
        renderFormatButtons();
        updateQualityVisibility();
      }
    );
  }
}

// Start
document.addEventListener('DOMContentLoaded', init);
