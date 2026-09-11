# Minimo Studio — Smart Image Converter & Studio (Chrome Extension)

A powerful, 100% offline, and private Chrome extension (Manifest V3) to convert and optimize images between **WebP, AVIF, PNG, JPG/JPEG, BMP, and ICO** directly in your browser.

---

## ✨ Features

- **🚀 100% Client-Side & Private**: All conversions run locally using HTML5 Canvas and Blobs. No images are ever uploaded to an external server.
- **🖱️ Webpage Right-Click Context Menu**:
  - Right-click **any image on any webpage** to instantly convert and download it (e.g. `Convert & Save as WebP`, `PNG`, `JPG`, `AVIF`).
  - Or select `Open in Side Panel Studio...` to inspect and fine-tune quality before saving.
- **⚡ Quick Toolbar Popup**:
  - Drag & drop images or paste directly from clipboard (<kbd>Cmd+V</kbd> / <kbd>Ctrl+V</kbd>).
  - Instant format switching, compression slider, scale presets (100%, 75%, 50%, 25%), and one-click downloads.
- **🎨 Advanced Side Panel Studio (`chrome.sidePanel`)**:
  - **Interactive Split Comparison Slider**: Drag the split line to compare Original vs Converted at pixel precision.
  - **Batch Queue & ZIP Export**: Convert dozens of files in bulk and download everything in a single `.zip` archive.
  - **Custom Pixel Resizing**: Scale by percentage or set exact pixel Width / Height with Aspect Ratio locking (🔒).
  - **Color & Filter Controls**: Grayscale, Invert, and customizable Alpha Background Fill (e.g. converting transparent PNGs to JPEG with white or custom colored background).
  - **Custom Filename Patterns**: Templates like `{name}-converted.{ext}`, `{name}_{width}x{height}.{ext}`, or `{name}_opti.{ext}`.

---

## 📦 Supported Formats

| Format | Transparency | Quality Control | Description |
| :--- | :---: | :---: | :--- |
| **WebP** | ✅ | ✅ (1–100%) | Modern web standard with superior compression (Recommended) |
| **AVIF** | ✅ | ✅ (1–100%) | Next-generation format with ultra-high compression efficiency |
| **JPG / JPEG** | ❌ | ✅ (1–100%) | Universal photo standard with customizable background fill |
| **PNG** | ✅ | Lossless | Crisp lossless raster graphics with alpha channel |
| **BMP** | ❌ | Lossless | Raw uncompressed bitmap |
| **ICO** | ✅ | Lossless | Standard multi-size browser favicon format |

---

## 🛠️ How to Install in Chrome

1. Build the extension bundle (already pre-built into `dist/`):
   ```bash
   pnpm run build
   ```
2. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
3. Enable **Developer mode** (toggle switch in the top-right corner).
4. Click **Load unpacked** in the top-left corner.
5. Select the **`dist`** folder inside this repository:
   ```
   /Users/andy/Sites/imageExtension/dist
   ```
6. The **OptiConvert** extension is now installed and ready to use! Pin it to your Chrome toolbar for quick access.

---

## 🧑‍💻 Development Commands

```bash
# Install dependencies
pnpm install

# Start Vite dev server for live UI preview
pnpm dev

# Build production Chrome extension into dist/
pnpm build
```
