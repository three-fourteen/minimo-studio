# Chrome Web Store Listing — Minimo Studio

> Last Updated: 2026-09-13  
> Version: 1.0.1

---

## 📋 Store Listing Metadata

**Extension Name** [REQUIRED]
```text
Minimo - Image Converter & Studio
```
*(34 / 75 characters)*

**Short Description** [REQUIRED]
```text
Convert and optimize images locally with a toolbar popup, side panel studio, and right-click save.
```
*(98 / 132 characters)*

Do **not** list every output format in the short description. CWS rejected 1.0.0 for keyword stuffing (`WebP, AVIF, PNG, JPG, BMP & ICO` — Yellow Argon).

**Category** [REQUIRED]
```text
Productivity → Tools
```
*(Spanish dashboard: Productividad → Herramientas.)*

Chrome no longer has a **Photos** category. **Tools** is the fit for a converter utility.

Lifestyle → Art & design (`Arte y diseño`) is the only other reasonable option if you want a creative-tools shelf instead of utilities.

**Single Purpose Statement** [REQUIRED]
```text
Convert, optimize, and resize images locally in the browser.
```

**Primary Language** [REQUIRED]
```text
English
```

---

## 📝 Detailed Description [REQUIRED]

*(Copy-paste directly into Chrome Web Store Developer Dashboard)*

```text
Minimo Studio converts and optimizes images entirely in your browser. Nothing is uploaded to a server.

Open the toolbar popup to drop or paste a file, or right-click an image on a page to convert it or send it to the studio. The side panel lets you compare original and converted results, adjust quality and size, and download one file or a ZIP of the queue.

Settings apply to new uploads. Use regenerate when you want existing queue items to pick up a new recipe.

You can fill transparent backgrounds when saving to a format that does not support alpha, apply grayscale or invert, and name outputs with simple patterns such as {name}-converted.{ext}.

Works with everyday photo and web formats, including JPEG, PNG, and WebP.

HOW TO USE

1. Click the Minimo icon in the toolbar.
2. Drop or paste an image, or right-click an image on a webpage.
3. Choose format and quality, then download — or open the studio for a side-by-side check and batch ZIP.
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
| `<all_urls>` | host_permissions | Required to fetch the image file the user just right-clicked, on any site. `activeTab` is not enough: it only unlocks the current tab, and most images are served from a different CDN origin than the page. A fixed site list would break “right-click any image.” Fetch runs only after that explicit click; conversion stays on-device; nothing is uploaded. |

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
   This generates `minimo-studio-v1.0.1.zip` ready for upload.

2. **Open Chrome Developer Dashboard**:
   - Go to [https://chrome.google.com/webstore/devconsole/](https://chrome.google.com/webstore/devconsole/)
   - Open the existing item (`bpbhlhpilohpmcnbjacelohmeoaoamaf`) and upload `minimo-studio-v1.0.1.zip` (do not create a new item).
   - Replace the short and detailed descriptions with the copy above before resubmitting.

3. **Fill Out Store Listing Tab**:
   - Copy-paste the **Title**, **Short Description**, and **Detailed Description** from above.
   - Select Category: **Productivity → Tools** (`Herramientas`). Do not look for Photos — it is gone.
   - Upload your 128×128 icon and at least 1 screenshot (1280×800).

4. **Fill Out Privacy Tab**:
   - Copy-paste the plain-English justifications for each permission from the table above.
   - Declare: **No user data collected**.
   - Check all three Data Use Certification boxes.

5. **Submit for Review**:
   - Click **Submit for Review**. Review typically takes 24–48 hours for extensions with no external network activity.

---

## Version History

| Version | Date | Notes |
| :--- | :--- | :--- |
| 1.0.1 | 2026-09-13 | Listing copy: remove format keyword list (CWS Yellow Argon). |
| 1.0.0 | 2026-09-11 | Initial store submission. |
