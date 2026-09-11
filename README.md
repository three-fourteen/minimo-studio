# Minimo Studio — Smart Image Converter & Studio (Chrome Extension)

A 100% local, private Chrome extension (Manifest V3) to convert and optimize images between **WebP, AVIF, PNG, JPG/JPEG, BMP, and ICO** in the browser.

---

## ✨ Features

- **🚀 Local & Private**: Conversions run in your browser. Images are never uploaded to a remote server.
- **🖱️ Webpage Right-Click Context Menu**:
  - Right-click **any image on any webpage** to convert and download it (WebP, PNG, JPG, AVIF).
  - Or select `Open in Minimo Studio...` to inspect and fine-tune quality before saving.
- **⚡ Quick Toolbar Popup**:
  - Drag & drop images or paste from clipboard (<kbd>Cmd+V</kbd> / <kbd>Ctrl+V</kbd>).
  - Format switching, compression slider, scale presets (100%, 75%, 50%, 25%), and one-click downloads.
  - Settings apply to **new** uploads. Use regenerate for items already in the queue.
- **🎨 Side Panel Studio**:
  - **Interactive Split Comparison Slider**: Compare Original vs Converted.
  - **Batch Queue & ZIP Export**: Convert many files and download a `.zip`.
  - **Custom Pixel Resizing**: Scale by percentage or set Width / Height with aspect-ratio lock.
  - **Color & Filter Controls**: Grayscale, Invert, and alpha background fill (for JPEG/BMP, or flattening PNG/WebP).
  - **Custom Filename Patterns**: `{name}-converted.{ext}`, `{name}_{width}x{height}.{ext}`, `{name}_opti.{ext}`.

---

## 📦 Supported Formats

| Format | Transparency | Quality Control | Description |
| :--- | :---: | :---: | :--- |
| **WebP** | ✅ | ✅ (1–100%) | Modern web standard with superior compression (Recommended) |
| **AVIF** | ✅ | ✅ (1–100%) | Next-generation format with high compression |
| **JPG / JPEG** | ❌ | ✅ (1–100%) | Universal photo standard with background fill |
| **PNG** | ✅ | Lossless | Lossless raster with alpha |
| **BMP** | ❌ | Lossless | Uncompressed bitmap |
| **ICO** | ✅ | Lossless | Favicon-style ICO (single embedded PNG) |

---

## 🛠️ How to Install in Chrome

1. Build the extension:
   ```bash
   pnpm install
   pnpm run build
   ```
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the **`dist/`** folder in this repo.
6. Pin **Minimo** to the toolbar.

---

## 🧑‍💻 Development Commands

```bash
pnpm install          # dependencies
pnpm dev              # Vite UI preview (not the loaded extension)
pnpm build            # production bundle → dist/
pnpm icons            # regenerate PNG icons from public/icons/icon.svg
pnpm pack             # build + zip dist/ for Chrome Web Store
```

Store listing copy and permission justifications: `CHROMEWEBSTORE.md`.
