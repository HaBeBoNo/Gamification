#!/usr/bin/env node
/**
 * generate-icons.js
 *
 * Generates public/icons/icon-192.png and public/icons/icon-512.png
 * from public/icons/icon.svg using the `sharp` package.
 *
 * Usage:
 *   npm install --save-dev sharp   (one-time)
 *   node scripts/generate-icons.js
 */

import { readFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const svgPath = resolve(root, 'public/icons/icon.svg');
const outDir = resolve(root, 'public/icons');

await mkdir(outDir, { recursive: true });

let sharp;
try {
  const mod = await import('sharp');
  sharp = mod.default;
} catch {
  console.error(
    '❌  sharp is not installed. Run: npm install --save-dev sharp\n' +
    '   Then re-run: node scripts/generate-icons.js'
  );
  process.exit(1);
}

const svgBuffer = await readFile(svgPath);

for (const size of [192, 512]) {
  const dest = resolve(outDir, `icon-${size}.png`);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(dest);
  console.log(`✅  Generated ${dest}`);
}
