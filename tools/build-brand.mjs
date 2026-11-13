// Builds the README banner (with the display face embedded so it renders on GitHub)
// and copies the mark into public/ for the favicon. Run: node tools/build-brand.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const mark = readFileSync('brand/logo-mark.svg', 'utf8');
const markInner = mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title[^>]*>.*?<\/title>/, '');
const font = readFileSync('node_modules/@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff2').toString('base64');

const banner = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" role="img" aria-labelledby="t">
  <title id="t">Pass the Wolf</title>
  <style>@font-face{font-family:'Alfa Slab One';src:url(data:font/woff2;base64,${font}) format('woff2');}
  .w{font-family:'Alfa Slab One',serif;fill:#e9dcc4;letter-spacing:2px}
  .s{font-family:'Alfa Slab One',serif;fill:#c9965b;letter-spacing:3px}</style>
  <rect width="1280" height="640" rx="28" fill="#1a1714"/>
  <rect x="18" y="18" width="1244" height="604" rx="18" fill="none" stroke="#c9965b" stroke-width="3" opacity="0.6"/>
  <svg x="80" y="96" width="448" height="448" viewBox="0 0 512 512">${markInner}</svg>
  <text class="w" x="584" y="268" font-size="104">PASS</text>
  <text class="w" x="584" y="372" font-size="104">THE <tspan fill="#d8473a">WOLF</tspan></text>
  <text class="s" x="588" y="448" font-size="22">ROLL THE PACK · PUSH YOUR LUCK</text>
</svg>
`;
writeFileSync('brand/logo-banner.svg', banner);
mkdirSync('public', { recursive: true });
writeFileSync('public/favicon.svg', mark);
console.log('brand assets written');
