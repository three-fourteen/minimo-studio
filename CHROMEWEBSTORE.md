# Chrome Web Store Listing — Minimo Studio

> Last Updated: 2026-09-11  
> Version: 1.0.0

---

## 📋 Store Listing Metadata

**Extension Name** [REQUIRED]
```text
Minimo - Image Converter & Studio
```
*(34 / 75 characters)*

**Short Description** [REQUIRED]
```text
Convert and optimize images to WebP, AVIF, PNG, JPG, BMP & ICO with a quick popup, side panel studio, and right-click context menu.
```
*(132 / 132 characters)*

**Category** [REQUIRED]
```text
Photos
```
*(Secondary: Productivity / Developer Tools)*

**Single Purpose Statement** [REQUIRED]
```text
Convert, optimize, and resize images locally in the browser across WebP, AVIF, PNG, JPG, BMP, and ICO formats.
```

**Primary Language** [REQUIRED]
```text
English
```

---

## 📝 Detailed Description [REQUIRED]

*(Copy-paste directly into Chrome Web Store Developer Dashboard)*

```text
Minimo Studio is a fast, lightweight, and 100% private image converter and optimizer that runs entirely inside your browser.

Convert, compress, and resize images across WebP, AVIF, PNG, JPG, BMP, and ICO with no server uploads and complete privacy.

KEY FEATURES

• Right-Click Any Web Image: Convert and download any image directly from the context menu (WebP, PNG, JPG, AVIF) or open it instantly in the side panel studio.
• Side Panel Studio: An interactive workspace featuring a side-by-side split comparison slider to inspect quality before downloading.
• Quick Toolbar Popup: Fast drag-and-drop or clipboard paste (Cmd+V / Ctrl+V) for instant conversions on the go.
• Batch Processing & Selective Download: Convert dozens of images simultaneously. Download all as a ZIP archive or pick individual files.
• Precision Controls: Adjust compression quality (1-100%), scale percentages (25% to 200%), or set exact width and height with aspect ratio locking.
• Color & Transparency Tools: Fill alpha transparency with solid colors (white, black, custom color) or apply grayscale/invert filters.
• Custom Filename Patterns: Automate output naming with dynamic variables ({name}, {width}, {height}, {ext}).
• Dark & Light Modes: Fully adaptive glassmorphic UI matching your system preference.

SUPPORTED FORMATS

• WebP (Lossy & Lossless with alpha)
• AVIF (Ultra-efficient next-generation compression)
• JPG / JPEG (Configurable background color fill)
• PNG (Lossless with alpha channel)
• BMP (Standard bitmap)
• ICO (favicon)

100% PRIVATE & OFFLINE

All conversions run locally in your browser. Images are never uploaded to a remote server or third-party service.

HOW TO USE

1. Click the Minimo icon in your toolbar to open the quick converter.
2. Drag and drop images or paste from your clipboard (Cmd+V / Ctrl+V).
3. Select your target format and quality slider.
4. Click Download or open the Side Panel Studio for advanced split-view comparison and batch ZIP export.
```

---

## 🔒 Permissions Justification (For Review Team)

| Permission | Type | Plain-English Justification for Review Team |
| :--- | :--- | :--- |
| `contextMenus` | permissions | Allows users to right-click any image on a webpage to instantly convert and download it in their desired format or open it in the Side Panel Studio. |
| `downloads` | permissions | Allows saving the converted image files and batch ZIP archives directly to the user's local Downloads folder. |
| `storage` | permissions | Used to persist user settings (default format, quality preset, theme) and temporarily transfer image queue items between the popup and the side panel. |
| `sidePanel` | permissions | Powers the advanced Side Panel Studio interface with split-view comparison and batch queue tools. |
| `offscreen` | permissions | Executes headless HTML5 Canvas rendering for image conversion triggered via the right-click context menu. |
| `<all_urls>` | host_permissions | Required to fetch and convert web images when the user explicitly right-clicks an image on an arbitrary webpage. All processing is strictly local. |

---

## 🛡️ Privacy & Data Use Disclosure

| Question | Answer |
| :--- | :--- |
| **Does the extension collect user data?** | **No** (0 data collected) |
| **Does the extension transmit data off-device?** | **No** (100% client-side offline execution) |
| **Are cookies, credentials, or personal info stored?** | **No** |
| **Are analytics or tracking SDKs included?** | **No** |

### Data Use Certification Checklist (In Developer Dashboard)
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## 🎨 Store Assets & Graphics Checklist

| Asset | Dimensions | Status | Location / Notes |
| :--- | :--- | :--- | :--- |
| **Store Icon** | 128×128 PNG | ✅ Ready | `public/icons/icon-128.png` |
| **Screenshot 1 (Side Panel Studio)** | 1280×800 or 640×400 | 🟡 To Capture | Split Comparison Slider & Quality Inspector |
| **Screenshot 2 (Quick Popup)** | 1280×800 or 640×400 | 🟡 To Capture | Quick format chips, dropzone, & compression |
| **Screenshot 3 (Context Menu)** | 1280×800 or 640×400 | 🟡 To Capture | Right-click webpage image instant conversion |
| **Screenshot 4 (Batch ZIP Export)** | 1280×800 or 640×400 | 🟡 To Capture | Multi-image queue and selective download |
| **Small Promo Tile (Optional)** | 440×280 PNG | 🟡 Optional | Featured tile for Chrome Web Store searches |
| **Marquee Promo Tile (Optional)** | 1400×560 PNG | 🟡 Optional | Hero banner for store placement |

---

## 🚀 Step-by-Step Publishing Guide

1. **Build & Package**:
   ```bash
   pnpm run pack
   ```
   This generates `minimo-studio-v1.0.0.zip` ready for upload.

2. **Open Chrome Developer Dashboard**:
   - Go to [https://chrome.google.com/webstore/devconsole/](https://chrome.google.com/webstore/devconsole/)
   - Click **New Item** and upload `minimo-studio-v1.0.0.zip`.

3. **Fill Out Store Listing Tab**:
   - Copy-paste the **Title**, **Short Description**, and **Detailed Description** from above.
   - Select Category: **Photos**.
   - Upload your 128×128 icon and at least 1 screenshot (1280×800).

4. **Fill Out Privacy Tab**:
   - Copy-paste the plain-English justifications for each permission from the table above.
   - Declare: **No user data collected**.
   - Check all three Data Use Certification boxes.

5. **Submit for Review**:
   - Click **Submit for Review**. Review typically takes 24–48 hours for extensions with no external network activity.
