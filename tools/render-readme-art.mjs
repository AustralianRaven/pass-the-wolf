// Renders the README pictures from a running build of the game:
//   brand/readme-animals.png  every animal in its main poses
//   brand/readme-table.png    the hex tray mid-game
//   brand/readme-winner.png   a moment from a winner cutscene
// Run: npm run build && npx vite preview --port 4173, then node tools/render-readme-art.mjs [base-url]
import { chromium } from '@playwright/test';

const base = (process.argv[2] ?? 'http://localhost:4173').replace(/\/$/, '');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

// 1. The animals.
// The portrait renderer is bundled in production, so the animals sheet is drawn by the score
// sheet itself: deal a table, open the score sheet for each animal and capture its tiles.
async function table(page, query, seats) {
  await page.goto(`${base}/${query}`);
  await page.waitForSelector('html[data-ready="true"]');
  await page.getByText('Table', { exact: true }).click();
  for (let i = 0; i < seats.length; i++) {
    if (i >= 2) await page.getByRole('button', { name: 'Add a seat' }).click();
    await page.getByLabel(`Seat ${i + 1} name`).fill(seats[i].name);
    if (seats[i].animal) {
      await page.getByRole('button', { name: new RegExp(`Seat ${i + 1} animal`) }).click();
      const den = page.getByRole('dialog', { name: /pick your animal/ });
      for (let k = 0; k < 8; k++) {
        if ((await den.locator('.wolfcard.is-focus h3').textContent()) === seats[i].animal) break;
        await den.getByRole('button', { name: 'Next animal' }).click();
        await page.waitForTimeout(250);
      }
      await den.locator('.wolfcard.is-focus').getByRole('button', { name: 'Choose' }).click();
    }
  }
  await page.getByRole('button', { name: 'Deal the wolves' }).click();
}

const animals = ['Winter Wolf', 'Pig', 'Gorilla', 'Beaver', 'Beaver in a Tuxedo', 'Tortoise'];
{
  const page = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
  const shots = [];
  for (const animal of animals) {
    await table(page, '?fast=1', [{ name: animal, animal }, { name: 'Ash' }]);
    await page.getByRole('button', { name: 'Take the wolves' }).click();
    await page.keyboard.press('s');
    const tiles = page.locator('.scorecard .tile');
    await page.waitForFunction(() => document.querySelectorAll('.scorecard .tile__art.is-ready').length >= 6, null, { timeout: 120000 });
    // The Prowl, Sniff and Howl slots (each animal names them its own way): three distinctive poses.
    const urls = await tiles.evaluateAll((els) => els.slice(1, 7).map((t) => t.querySelector('img')?.src ?? ''));
    const names = await tiles.evaluateAll((els) => els.slice(1, 7).map((t) => t.querySelector('.tile__name')?.textContent ?? ''));
    shots.push({ animal, urls: [urls[1], urls[2], urls[4]], names: [names[1], names[2], names[4]] });
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1180, height: 100 });
  await page.setContent(`<body style="margin:0;background:#120c22;color:#e9e4f7;font:700 15px system-ui">
    <div style="display:grid;grid-template-columns:repeat(3,390px);gap:4px;padding:6px">
    ${shots.map((s) => s.urls.map((u, i) => `<figure style="margin:0;position:relative"><img src="${u}" width="390" style="display:block"><figcaption style="position:absolute;left:10px;bottom:8px">${s.animal}: ${s.names[i]}</figcaption></figure>`).join('')).join('')}
    </div></body>`);
  await page.waitForTimeout(500);
  await page.locator('div').first().screenshot({ path: 'brand/readme-animals.png' });
  await page.close();
}

// 2. The table mid-game.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await table(page, '?seed=11', [{ name: 'Kat' }, { name: 'Ash', animal: 'Pig' }]);
  await page.getByRole('button', { name: 'Take the wolves' }).click();
  await page.getByRole('button', { name: 'Auto-roll' }).click();
  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'brand/readme-table.png' });
  await page.close();
}

// 3. A winner cutscene.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${base}/wins-screens.html`);
  await page.waitForSelector('html[data-ready="true"]');
  await page.getByLabel('Players').selectOption('4');
  await page.getByLabel('Scene').selectOption('summit');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.locator('.winner').waitFor();
  // The scene starts once every animal is carved: time the shot from its first drawn frame.
  await page.waitForFunction(() => (document.querySelector('.winner__scene')?.width ?? 0) > 300, null, { timeout: 120000 });
  await page.waitForTimeout(6400);
  await page.screenshot({ path: 'brand/readme-winner.png' });
  await page.close();
}

await browser.close();
console.log('README art written');
