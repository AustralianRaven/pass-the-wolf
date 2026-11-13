// Renders an SVG file to PNG with Playwright's Chromium. Usage: node tools/render-svg.mjs in.svg out.png width height
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const [input, output, w, h] = process.argv.slice(2);
const svg = readFileSync(input, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${w}" height="${h}" `)}</body></html>`);
await page.waitForTimeout(300);
await page.screenshot({ path: output, omitBackground: true });
await browser.close();
