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
let resizeMode: 'scale' | 'custom' = 'scale';
let scale: number = 1.0;
let customWidth: number | undefined;
let customHeight: number | undefined;
let lockAspectRatio: boolean = true;
let filterGrayscale: boolean = false;
let filterInvert: boolean = false;
let backgroundColor: string = '#ffffff';
let filenamePattern: string = '{name}-converted.{ext}';

let queue: QueueItem[] = [];
let activeItemId: string | null = null;
let isProcessing: boolean = false;
const selectedItemIds = new Set<string>();

// Split Slider State
let isDraggingHandle: boolean = false;

// DOM Elements
const studioFormatGrid = document.getElementById('studio-format-grid') as HTMLDivElement;
const studioQualityRow = document.getElementById('studio-quality-row') as HTMLDivElement;
const studioQualitySlider = document.getElementById('studio-quality-slider') as HTMLInputElement;
const studioQualityVal = document.getElementById('studio-quality-val') as HTMLSpanElement;
const studioDropzone = document.getElementById('studio-dropzone') as HTMLDivElement;
const studioFileInput = document.getElementById('studio-file-input') as HTMLInputElement;
const btnHeaderAdd = document.getElementById('btn-header-add') as HTMLButtonElement;
const btnThemeToggle = document.getElementById('btn-theme-toggle') as HTMLElement;

const comparisonSection = document.getElementById('comparison-section') as HTMLElement;
const splitViewer = document.getElementById('split-viewer') as HTMLDivElement;
const splitImgOriginal = document.getElementById('split-img-original') as HTMLImageElement;
const splitImgConverted = document.getElementById('split-img-converted') as HTMLImageElement;
const splitTagConverted = document.getElementById('split-tag-converted') as HTMLSpanElement;
const activeImageMeta = document.getElementById('active-image-meta') as HTMLDivElement;
const activeSavingsDisplay = document.getElementById('active-savings-display') as HTMLDivElement;
const btnDownloadActive = document.getElementById('btn-download-active') as HTMLButtonElement;

const resizeModeControl = document.getElementById('resize-mode-control') as HTMLDivElement;
const scaleControls = document.getElementById('scale-controls') as HTMLDivElement;
const customDimControls = document.getElementById('custom-dim-controls') as HTMLDivElement;
const dimWidth = document.getElementById('dim-width') as HTMLInputElement;
const dimHeight = document.getElementById('dim-height') as HTMLInputElement;
const btnLockAspect = document.getElementById('btn-lock-aspect') as HTMLButtonElement;

const chkGrayscale = document.getElementById('filter-grayscale') as HTMLInputElement;
const chkInvert = document.getElementById('filter-invert') as HTMLInputElement;
const customColorPicker = document.getElementById('custom-color-picker') as HTMLInputElement;
const filenamePatternSelect = document.getElementById('filename-pattern') as HTMLSelectElement;

const queueSection = document.getElementById('queue-section') as HTMLElement;
const studioQueueList = document.getElementById('studio-queue-list') as HTMLDivElement;
const queueCountBadge = document.getElementById('queue-count-badge') as HTMLSpanElement;
const batchSummaryBar = document.getElementById('batch-summary-bar') as HTMLDivElement;
const btnClearQueue = document.getElementById('btn-clear-queue') as HTMLButtonElement;
const chkSelectAll = document.getElementById('chk-select-all') as HTMLInputElement;
const studioFooter = document.getElementById('studio-footer') as HTMLElement;
const btnBatchDownloadZip = document.getElementById('btn-batch-download-zip') as HTMLButtonElement;
const batchZipBtnText = document.getElementById('batch-zip-btn-text') as HTMLSpanElement;

// Initialization
function init(): void {
  initTheme(btnThemeToggle);
  renderFormatButtons();
  setupEventListeners();
  setupSplitSlider();
  updateQualityPresetButtons(85);
  checkPendingImports();
}

function renderFormatButtons(): void {
  studioFormatGrid.innerHTML = '';
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
        .querySelectorAll('#studio-format-grid .format-pill')
        .forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      updateQualityVisibility();
      reprocessQueue();
    });

    studioFormatGrid.appendChild(pill);
  });
}

function updateQualityVisibility(): void {
  const opt = getFormatOption(selectedFormat);
  studioQualityRow.style.display = opt.supportsQuality ? 'flex' : 'none';
}

function getCurrentOptions(): ConversionOptions {
  return {
    format: selectedFormat,
    quality: quality,
    scale: resizeMode === 'scale' ? scale : undefined,
    width: resizeMode === 'custom' ? customWidth : undefined,
    height: resizeMode === 'custom' ? customHeight : undefined,
    keepAspectRatio: lockAspectRatio,
    backgroundColor: backgroundColor,
    filters: {
      grayscale: filterGrayscale,
      invert: filterInvert,
    },
    filenamePattern: filenamePattern,
  };
}

function updateQualityPresetButtons(val: number): void {
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    const q = parseInt((btn as HTMLElement).dataset.quality || '0', 10);
    btn.classList.toggle('active', q === val);
  });
}

function setupEventListeners(): void {
  // Dropzone & File input
  studioDropzone.addEventListener('click', () => studioFileInput.click());
  btnHeaderAdd.addEventListener('click', () => studioFileInput.click());

  studioFileInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files));
    }
    studioFileInput.value = '';
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach((name) => {
    studioDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      studioDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach((name) => {
    studioDropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      studioDropzone.classList.remove('dragover');
    });
  });

  studioDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFiles(Array.from(dt.files));
    }
  });

  // Paste handler
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
            `pasted_image_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
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
  let debounceTimer: ReturnType<typeof setTimeout>;
  studioQualitySlider.addEventListener('input', () => {
    const val = parseInt(studioQualitySlider.value, 10);
    quality = val / 100;
    studioQualityVal.textContent = `${val}%`;
    updateQualityPresetButtons(val);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => reprocessQueue(), 150);
  });

  // Quality preset buttons
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = parseInt((btn as HTMLElement).dataset.quality || '85', 10);
      quality = q / 100;
      studioQualitySlider.value = String(q);
      studioQualityVal.textContent = `${q}%`;
      updateQualityPresetButtons(q);
      reprocessQueue();
    });
  });

  // Resize mode toggle
  resizeModeControl.querySelectorAll('.segmented-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      resizeModeControl
        .querySelectorAll('.segmented-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      resizeMode = (btn as HTMLElement).dataset.mode as 'scale' | 'custom';
      if (resizeMode === 'scale') {
        scaleControls.style.display = 'flex';
        customDimControls.style.display = 'none';
      } else {
        scaleControls.style.display = 'none';
        customDimControls.style.display = 'grid';
      }
      reprocessQueue();
    });
  });

  // Scale buttons
  scaleControls.querySelectorAll('.segmented-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      scaleControls
        .querySelectorAll('.segmented-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      scale = parseFloat((btn as HTMLElement).dataset.scale || '1');
      reprocessQueue();
    });
  });

  // Custom dimension inputs
  btnLockAspect.addEventListener('click', () => {
    lockAspectRatio = !lockAspectRatio;
    btnLockAspect.classList.toggle('active', lockAspectRatio);
    btnLockAspect.textContent = lockAspectRatio ? '🔒' : '🔓';
  });

  dimWidth.addEventListener('input', () => {
    const val = parseInt(dimWidth.value, 10);
    customWidth = isNaN(val) ? undefined : val;
    const activeItem = getActiveItem();
    if (lockAspectRatio && activeItem && customWidth) {
      const ratio = activeItem.originalHeight / activeItem.originalWidth;
      customHeight = Math.round(customWidth * ratio);
      dimHeight.value = String(customHeight);
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => reprocessQueue(), 250);
  });

  dimHeight.addEventListener('input', () => {
    const val = parseInt(dimHeight.value, 10);
    customHeight = isNaN(val) ? undefined : val;
    const activeItem = getActiveItem();
    if (lockAspectRatio && activeItem && customHeight) {
      const ratio = activeItem.originalWidth / activeItem.originalHeight;
      customWidth = Math.round(customHeight * ratio);
      dimWidth.value = String(customWidth);
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => reprocessQueue(), 250);
  });

  // Filters
  chkGrayscale.addEventListener('change', () => {
    filterGrayscale = chkGrayscale.checked;
    reprocessQueue();
  });

  chkInvert.addEventListener('change', () => {
    filterInvert = chkInvert.checked;
    reprocessQueue();
  });

  // Background color swatches
  document.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      document
        .querySelectorAll('.color-swatch')
        .forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      backgroundColor = (swatch as HTMLElement).dataset.color || '#ffffff';
      reprocessQueue();
    });
  });

  customColorPicker.addEventListener('input', () => {
    document
      .querySelectorAll('.color-swatch')
      .forEach((s) => s.classList.remove('active'));
    backgroundColor = customColorPicker.value;
    reprocessQueue();
  });

  // Filename pattern
  filenamePatternSelect.addEventListener('change', () => {
    filenamePattern = filenamePatternSelect.value;
    reprocessQueue();
  });

  // Actions
  btnClearQueue.addEventListener('click', clearQueue);
  btnDownloadActive.addEventListener('click', downloadActiveItem);
  btnBatchDownloadZip.addEventListener('click', downloadAllZip);

  const btnReprocessAll = document.getElementById('btn-reprocess-all');
  if (btnReprocessAll) {
    btnReprocessAll.addEventListener('click', () => {
      reprocessQueue();
    });
  }

  // Master Select All / Deselect All
  if (chkSelectAll) {
    chkSelectAll.addEventListener('change', () => {
      if (chkSelectAll.checked) {
        queue.forEach((q) => selectedItemIds.add(q.id));
      } else {
        selectedItemIds.clear();
      }
      renderQueueList();
      updateSelectionUI();
    });
  }

  // Chrome runtime listener for images sent via context menu
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'SEND_TO_SIDEPANEL' && msg.payload) {
        importFromPayload(msg.payload);
      }
    });
  }

  // Storage listener if image sent while sidepanel already opened
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.pendingContextMenuImage?.newValue) {
        const srcUrl = changes.pendingContextMenuImage.newValue;
        importFromPayload({ srcUrl });
        chrome.storage.local.remove('pendingContextMenuImage');
      }
    });
  }
}

function setupSplitSlider(): void {
  const updateSplit = (clientX: number) => {
    const rect = splitViewer.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = Math.round((x / rect.width) * 1000) / 10;
    splitViewer.style.setProperty('--split-pos', `${percentage}%`);
  };

  const onPointerDown = (e: MouseEvent | TouchEvent) => {
    isDraggingHandle = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    updateSplit(clientX);
  };

  const onPointerMove = (e: MouseEvent | TouchEvent) => {
    if (!isDraggingHandle) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    updateSplit(clientX);
  };

  const onPointerUp = () => {
    isDraggingHandle = false;
  };

  splitViewer.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  splitViewer.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp);
}

async function handleFiles(files: File[]): Promise<void> {
  const imageFiles = files.filter(
    (f) =>
      f.type.startsWith('image/') ||
      f.name.match(/\.(jpe?g|png|webp|avif|bmp|gif|svg|tiff?|ico)$/i)
  );
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

      const item: QueueItem = {
        id: createUniqueId(),
        name: file.name,
        originalSize: file.size,
        originalWidth: img.naturalWidth || img.width,
        originalHeight: img.naturalHeight || img.height,
        originalType: file.type || 'image/png',
        originalDataUrl: dataUrl,
        originalBlob: file,
        options: getCurrentOptions(),
        status: 'idle',
        timestamp: Date.now(),
      };

      queue.push(item);
      selectedItemIds.add(item.id);
      // Automatically switch preview to the newly uploaded image
      activeItemId = item.id;
    } catch (err) {
      console.error('Failed to load image:', file.name, err);
    }
  }

  updateStudioUI();
  processQueue();
}

async function importFromPayload(payload: {
  srcUrl: string;
  filename?: string;
}): Promise<void> {
  try {
    let file: File;
    try {
      const response = await fetch(payload.srcUrl);
      const blob = await response.blob();
      const filename = payload.filename || 'web_image.png';
      file = new File([blob], filename, { type: blob.type || 'image/png' });
    } catch {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(new Error('Failed to load web image element: ' + e));
        img.src = payload.srcUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
      file = new File([blob], payload.filename || 'web_image.png', { type: 'image/png' });
    }
    await handleFiles([file]);
  } catch (err) {
    console.error('Failed to import image payload:', err);
  }
}

async function checkPendingImports(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['pendingQueue', 'pendingContextMenuImage'], async (res) => {
      if (res.pendingContextMenuImage) {
        await importFromPayload({ srcUrl: res.pendingContextMenuImage });
        chrome.storage.local.remove('pendingContextMenuImage');
      }
      if (res.pendingQueue && Array.isArray(res.pendingQueue)) {
        for (const item of res.pendingQueue) {
          const resBlob = await (await fetch(item.originalDataUrl)).blob();
          const file = new File([resBlob], item.name, { type: item.originalType });
          await handleFiles([file]);
        }
        chrome.storage.local.remove('pendingQueue');
      }
    });
  }
}

function getActiveItem(): QueueItem | undefined {
  return queue.find((q) => q.id === activeItemId) || queue[0];
}

async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  const currentOpts = getCurrentOptions();

  // Prioritize active item first for instant live preview feedback
  const itemsToProcess = [
    ...queue.filter((q) => q.id === activeItemId && q.status !== 'completed'),
    ...queue.filter((q) => q.id !== activeItemId && q.status !== 'completed'),
  ];

  for (const item of itemsToProcess) {
    item.status = 'processing';
    renderQueueList();

    try {
      item.options = currentOpts;
      const result = await convertImage(
        item.originalBlob,
        currentOpts,
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

    renderQueueList();
    renderBatchSummary();
    updateSelectionUI();
    if (item.id === activeItemId) {
      updateActivePreview();
    }
  }

  isProcessing = false;
  updateStudioUI();
}

function reprocessQueue(): void {
  if (queue.length === 0) return;
  queue.forEach((item) => {
    item.status = 'idle';
  });
  processQueue();
}

async function regenerateSingleItem(itemId: string): Promise<void> {
  const item = queue.find((q) => q.id === itemId);
  if (!item) return;

  item.status = 'processing';
  renderQueueList();

  try {
    const currentOpts = getCurrentOptions();
    item.options = currentOpts;
    const result = await convertImage(
      item.originalBlob,
      currentOpts,
      item.name,
      item.originalSize
    );
    item.result = result;
    item.status = 'completed';
  } catch (err: any) {
    console.error('Regeneration failed for item:', item.name, err);
    item.status = 'error';
    item.error = err.message || 'Conversion error';
  }

  renderQueueList();
  if (item.id === activeItemId) {
    updateActivePreview();
  }
  renderBatchSummary();
}

function updateSelectionUI(): void {
  const totalCount = queue.length;
  const selectedCount = selectedItemIds.size;

  if (chkSelectAll) {
    chkSelectAll.checked = selectedCount === totalCount && totalCount > 0;
    chkSelectAll.indeterminate = selectedCount > 0 && selectedCount < totalCount;
  }

  queueCountBadge.textContent = `${selectedCount}/${totalCount} Selected`;

  const completedSelected = queue.filter(
    (q) => selectedItemIds.has(q.id) && q.status === 'completed' && q.result
  );

  if (completedSelected.length === 0) {
    batchZipBtnText.textContent = totalCount === 0 ? 'No images' : 'Select images to download';
    btnBatchDownloadZip.disabled = true;
  } else if (completedSelected.length === 1) {
    batchZipBtnText.textContent = `Download (${completedSelected[0].result!.filename})`;
    btnBatchDownloadZip.disabled = false;
  } else if (completedSelected.length === totalCount) {
    batchZipBtnText.textContent = `Download All (${completedSelected.length} Images as ZIP)`;
    btnBatchDownloadZip.disabled = false;
  } else {
    batchZipBtnText.textContent = `Download Selected (${completedSelected.length} of ${totalCount} as ZIP)`;
    btnBatchDownloadZip.disabled = false;
  }
}

function updateStudioUI(): void {
  if (queue.length === 0) {
    comparisonSection.style.display = 'none';
    queueSection.style.display = 'none';
    studioFooter.style.display = 'none';
    studioDropzone.style.display = 'block';
  } else {
    comparisonSection.style.display = 'flex';
    queueSection.style.display = 'flex';
    studioFooter.style.display = 'block';
    studioDropzone.style.display = 'block';

    updateActivePreview();
    renderQueueList();
    renderBatchSummary();
    updateSelectionUI();
  }
}

function updateActivePreview(): void {
  const active = getActiveItem();
  if (!active) return;

  splitImgOriginal.src = active.originalDataUrl;
  splitTagConverted.textContent = `Converted (${getFormatOption(selectedFormat).label})`;

  if (active.result) {
    splitImgConverted.src = active.result.dataUrl;
    const savings = calculateSavings(active.originalSize, active.result.size);
    const badgeClass = savings.isReduction ? 'badge-emerald' : 'badge-amber';

    activeImageMeta.textContent = `${active.result.width} × ${active.result.height} px`;
    activeSavingsDisplay.innerHTML = `
      <span>${formatBytes(active.originalSize)} ➔ <strong>${formatBytes(active.result.size)}</strong></span>
      <span class="badge ${badgeClass}">${savings.formatted}</span>
    `;
    btnDownloadActive.disabled = false;
  } else {
    splitImgConverted.src = active.originalDataUrl;
    activeImageMeta.textContent = `${active.originalWidth} × ${active.originalHeight} px`;
    activeSavingsDisplay.innerHTML = `<span class="badge badge-primary">Processing...</span>`;
    btnDownloadActive.disabled = true;
  }
}

function renderBatchSummary(): void {
  const completed = queue.filter((q) => q.status === 'completed' && q.result);
  if (completed.length === 0) {
    batchSummaryBar.style.display = 'none';
    return;
  }

  batchSummaryBar.style.display = 'flex';
  const totalOriginal = completed.reduce((sum, q) => sum + q.originalSize, 0);
  const totalConverted = completed.reduce((sum, q) => sum + (q.result?.size || 0), 0);
  const totalSavings = calculateSavings(totalOriginal, totalConverted);

  batchSummaryBar.innerHTML = `
    <div>Batch: <strong>${formatBytes(totalOriginal)}</strong> ➔ <strong>${formatBytes(totalConverted)}</strong></div>
    <div class="summary-savings-highlight">Saved ${totalSavings.formatted} (${formatBytes(Math.max(0, totalOriginal - totalConverted))})</div>
  `;
}

function renderQueueList(): void {
  studioQueueList.innerHTML = '';
  queue.forEach((item) => {
    const card = document.createElement('div');
    card.className = `studio-queue-item ${item.id === activeItemId ? 'active' : ''}`;
    card.id = `studio-item-${item.id}`;

    const thumbUrl = item.result?.dataUrl || item.originalDataUrl;
    const isChecked = selectedItemIds.has(item.id);
    let statusMeta = '';

    if (item.status === 'processing') {
      statusMeta = `<span class="badge badge-primary">Converting...</span>`;
    } else if (item.status === 'error') {
      statusMeta = `<span class="badge badge-rose">Error</span>`;
    } else if (item.status === 'completed' && item.result) {
      const sav = calculateSavings(item.originalSize, item.result.size);
      const bClass = sav.isReduction ? 'badge-emerald' : 'badge-amber';
      statusMeta = `
        <span class="size-orig">${formatBytes(item.originalSize)}</span>
        <span class="size-arrow">➔</span>
        <span class="size-conv">${formatBytes(item.result.size)}</span>
        <span class="badge ${bClass}">${sav.formatted}</span>
      `;
    }

    card.innerHTML = `
      <input type="checkbox" class="item-checkbox queue-item-chk" ${isChecked ? 'checked' : ''} title="Select for download" />
      <img src="${thumbUrl}" class="queue-item-thumb" alt="thumb" />
      <div class="queue-item-info">
        <div class="queue-item-title" title="${item.name}">${item.name}</div>
        <div class="queue-item-meta">${statusMeta}</div>
      </div>
      <div class="queue-item-actions">
        <button class="btn btn-icon btn-regen-item" title="Regenerate with current settings">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
        ${
          item.status === 'completed' && item.result
            ? `<button class="btn btn-icon btn-dl-item" title="Download">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>`
            : ''
        }
        <button class="btn btn-icon btn-del-item" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    // Click item to make active preview
    card.addEventListener('click', () => {
      activeItemId = item.id;
      document
        .querySelectorAll('.studio-queue-item')
        .forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
      updateActivePreview();
    });

    // Checkbox toggle
    const chk = card.querySelector('.queue-item-chk') as HTMLInputElement;
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

    // Item regenerate button
    const btnRegen = card.querySelector('.btn-regen-item');
    if (btnRegen) {
      btnRegen.addEventListener('click', async (e) => {
        e.stopPropagation();
        await regenerateSingleItem(item.id);
      });
    }

    // Item download button
    const btnDl = card.querySelector('.btn-dl-item');
    if (btnDl && item.result) {
      btnDl.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerBlobDownload(item.result!.blob, item.result!.filename);
      });
    }

    // Item delete button
    const btnDel = card.querySelector('.btn-del-item');
    if (btnDel) {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedItemIds.delete(item.id);
        queue = queue.filter((q) => q.id !== item.id);
        if (activeItemId === item.id) {
          activeItemId = queue.length > 0 ? queue[0].id : null;
        }
        updateStudioUI();
      });
    }

    studioQueueList.appendChild(card);
  });
}

function downloadActiveItem(): void {
  const active = getActiveItem();
  if (active && active.result) {
    triggerBlobDownload(active.result.blob, active.result.filename);
  }
}

async function downloadAllZip(): Promise<void> {
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
    triggerBlobDownload(zipBlob, `minimo_studio_${Date.now()}.zip`);
  }
}

function clearQueue(): void {
  queue = [];
  selectedItemIds.clear();
  activeItemId = null;
  updateStudioUI();
}

// Start
document.addEventListener('DOMContentLoaded', init);
