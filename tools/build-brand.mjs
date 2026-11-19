// Builds the brand assets from the favicon (the source of truth for the mark):
//   brand/logo-mark.svg      a copy of public/favicon.svg
//   brand/logo-banner.svg    the README banner, with its fonts embedded so it renders on GitHub
//   brand/social-preview.png 1280x640 for the repo's social preview (rendered from the banner)
// Run: node tools/build-brand.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const mark = readFileSync('public/favicon.svg', 'utf8');
writeFileSync('brand/logo-mark.svg', mark);
const markInner = mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title[^>]*>.*?<\/title>/, '');

const font = (path) => readFileSync(path).toString('base64');
const gotisch = font('node_modules/@fontsource-variable/grenze-gotisch/files/grenze-gotisch-latin-wght-normal.woff2');
const grenze = font('node_modules/@fontsource/grenze/files/grenze-latin-900-normal.woff2');

// Gouge marks: the short carved strokes that texture every linocut surface in the game.
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gouges = Array.from({ length: 22 }, (_, i) => {
  const x = Math.round(50 + rand() * 1150);
  const y = Math.round(50 + rand() * 530);
  const w = Math.round(36 + rand() * 60);
  return `<path d="M${x} ${y} q${w / 2} ${i % 2 ? -4 : 4} ${w} 0"/>`;
}).join('');

const banner = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" role="img" aria-labelledby="t">
  <title id="t">Pass the Wolf</title>
  <style>
    @font-face{font-family:'Grenze Gotisch';src:url(data:font/woff2;base64,${gotisch}) format('woff2');font-weight:100 900;}
    @font-face{font-family:'Grenze';src:url(data:font/woff2;base64,${grenze}) format('woff2');font-weight:900;}
    .mark{font-family:'Grenze Gotisch',serif;font-weight:900;fill:#e9e4f7}
    .small{font-family:'Grenze',serif;font-weight:900;fill:#e9e4f7}
    .tag{font-family:'Grenze',serif;font-weight:900;fill:#a58bd6;letter-spacing:2px}
  </style>
  <rect width="1280" height="640" fill="#120c22"/>
  <g fill="none" stroke="#2f2152" stroke-width="5" stroke-linecap="round">${gouges}</g>
  <path d="M24 30 L640 22 L1256 30 L1250 320 L1258 612 L640 618 L22 610 L30 320 Z" fill="none" stroke="#e9e4f7" stroke-width="4" stroke-linejoin="round"/>
  <svg x="92" y="110" width="420" height="420" viewBox="0 0 512 512">${markInner}</svg>
  <text class="small" x="580" y="268" font-size="64">Pass the</text>
  <text class="mark" x="572" y="430" font-size="200" style="paint-order:stroke" stroke="#7a5cc4" stroke-width="6">Wolf</text>
  <text class="tag" x="584" y="500" font-size="30">THROW THE PACK · PUSH YOUR LUCK</text>
</svg>
`;
writeFileSync('brand/logo-banner.svg', banner);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.setContent(`<body style="margin:0">${banner}</body>`);
await page.waitForTimeout(300);
await page.screenshot({ path: 'brand/social-preview.png' });
await browser.close();
console.log('brand assets written');
