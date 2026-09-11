import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf-8'));
const outputZip = path.resolve(rootDir, `minimo-studio-v${pkg.version}.zip`);

async function addDirectoryToZip(zip, dirPath, rootPath) {
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const relPath = path.relative(rootPath, fullPath);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await addDirectoryToZip(zip, fullPath, rootPath);
    } else {
      const content = fs.readFileSync(fullPath);
      zip.file(relPath, content);
    }
  }
}

async function pack() {
  if (!fs.existsSync(distDir)) {
    console.error('dist/ folder does not exist. Run "pnpm run build" first.');
    process.exit(1);
  }

  const manifestPath = path.join(distDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('dist/manifest.json not found. Build is incomplete.');
    process.exit(1);
  }

  console.log(`Packaging dist/ into ${path.basename(outputZip)}...`);
  const zip = new JSZip();
  await addDirectoryToZip(zip, distDir, distDir);

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZip, zipBuffer);
  console.log(`✅ Package created successfully: ${path.basename(outputZip)} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`Ready for Chrome Web Store upload!`);
}

pack().catch((err) => {
  console.error('Failed to package extension:', err);
  process.exit(1);
});
