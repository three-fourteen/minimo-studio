import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const iconDir = path.resolve('public/icons');
const svgPath = path.join(iconDir, 'icon.svg');

if (!fs.existsSync(svgPath)) {
  console.error('Missing public/icons/icon.svg — cannot generate PNG icons.');
  process.exit(1);
}

const masterSvg = fs.readFileSync(svgPath);
const sizes = [16, 32, 48, 128];

async function generateAllIcons() {
  for (const size of sizes) {
    const outPath = path.join(iconDir, `icon-${size}.png`);
    await sharp(masterSvg)
      .resize(size, size, { fit: 'contain' })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outPath);
    console.log(`Generated ${outPath} (${size}x${size})`);
  }
}

generateAllIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
