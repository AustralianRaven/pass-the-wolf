import { expect, test, type Page } from '@playwright/test';

/**
 * Game flow, driven deterministically:
 * `fast=1` settles throws instantly; `force=` fixes each landing in order (see src/game/debug.ts).
 */
const open = async (page: Page, force: string[], extra = '') => {
  await page.goto(`/?fast=1&seed=1&force=${force.join(',')}${extra}`);
  await expect(page.locator('html'), 'Then the table has finished loading').toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
};

const pot = (page: Page) => page.locator('.plate__pot dd');
const handover = (page: Page) => page.locator('.handover');
const status = (page: Page) => page.getByRole('status');

async function startTable(page: Page, names: string[], target = 'First to 100') {
  await page.getByText('Table', { exact: true }).click();
  await expect(page.getByLabel('Seat 1 name'), 'Then table mode shows seat 1').toBeVisible();
  for (let i = 0; i < names.length; i++) {
    if (i >= 2) await page.getByRole('button', { name: 'Add a seat' }).click();
    const input = page.getByLabel(`Seat ${i + 1} name`);
    await input.fill(names[i]!);
    await expect(input, `Then seat ${i + 1} is named ${names[i]}`).toHaveValue(names[i]!);
  }
  await page.getByLabel('Race').selectOption({ label: target });
  await page.getByRole('button', { name: 'Deal the wolves' }).click();
  await expect(handover(page), 'Then the first handover band is shown').toBeVisible();
}

async function takeWolves(page: Page, name: string) {
  await expect(page.getByRole('heading', { name: `${name}'s turn` }), `Then the band announces ${name}`).toBeVisible();
  await page.getByRole('button', { name: 'Take the wolves' }).click();
  await expect(handover(page), 'Then the band clears').toBeHidden();
  await expect(page.locator('.plate__name'), `Then the plate shows ${name}`).toHaveText(name);
}

test.describe('Feature: setting up a table', () => {
  test('Scenario: Given three named players, When the game starts, Then the first player is handed the wolves', async ({ page }) => {
    await open(page, []);
    await startTable(page, ['Kat', 'Ash', 'Rowan']);
    await expect(page.locator('.handover__summary'), 'Then the band states the race target').toHaveText('Race to 100.');
    await takeWolves(page, 'Kat');
    await expect(page.getByRole('img', { name: /Race to 100: Kat 0, Ash 0, Rowan 0/ }), 'Then the pegboard has a lane per player').toBeVisible();
  });

  test('Scenario: Given a game was set up before, When the page reloads, Then the names are remembered', async ({ page }) => {
    await open(page, []);
    await startTable(page, ['Kat', 'Ash']);
    await page.reload();
    await expect(page.getByLabel('Seat 1 name'), 'Then seat 1 keeps its name').toHaveValue('Kat');
    await expect(page.getByLabel('Seat 2 name'), 'Then seat 2 keeps its name').toHaveValue('Ash');
  });
});

test.describe('Feature: rolling and banking', () => {
  const rolls = [
    { force: 'tailDown/sideMarkUp', label: 'Howl', points: 25 },
    { force: 'lean/sideMarkDown', label: 'Pounce', points: 15 },
    { force: 'noseDown/noseDown', label: 'Double Sniff', points: 40 },
    { force: 'back/upright', label: 'Play Dead + Prowl', points: 10 },
    { force: 'sideMarkUp/sideMarkUp', label: 'Den', points: 1 },
  ];
  for (const r of rolls) {
    test(`Scenario: Given a ${r.label} landing, When Kat banks, Then ${r.points} points are banked and Ash is up`, async ({ page }) => {
      await open(page, [r.force]);
      await startTable(page, ['Kat', 'Ash']);
      await takeWolves(page, 'Kat');
      await page.getByRole('button', { name: 'Roll' }).click();
      await expect(status(page), `Then the result is announced as ${r.label}`).toContainText(`${r.label}. +${r.points}`);
      await expect(pot(page), `Then the turn pot holds ${r.points}`).toHaveText(String(r.points));
      await page.getByRole('button', { name: `Bank ${r.points}` }).click();
      await expect(page.locator('.handover__summary'), 'Then the band reports the bank').toHaveText(`Kat banks ${r.points}, now on ${r.points}.`);
      await takeWolves(page, 'Ash');
      await page.keyboard.press('s');
      const cell = page.locator('.scorecard tbody tr').first().locator('td').first();
      await expect(cell, 'Then the score card shows the banked points in round 1').toHaveText(`+${r.points}`);
    });
  }
});

test.describe('Feature: busting', () => {
  test('Scenario: Given a pot of 5, When the wolves Scatter, Then the pot is lost and the dice pass on', async ({ page }) => {
    await open(page, ['back/sideMarkUp', 'sideMarkUp/sideMarkDown']);
    await startTable(page, ['Kat', 'Ash']);
    await takeWolves(page, 'Kat');
    await page.getByRole('button', { name: 'Roll' }).click();
    await expect(pot(page), 'Then the pot holds 5').toHaveText('5');
    await page.getByRole('button', { name: 'Roll' }).click();
    await expect(page.locator('.handover__summary'), 'Then the band reports the scatter').toHaveText('Scattered. Kat loses 5 from the pot.');
    await expect(page.getByRole('heading', { name: "Ash's turn" }), 'Then Ash is up next').toBeVisible();
  });

  test('Scenario: Given Kat has 25 banked, When the wolves end Tangled, Then her bank is wiped to 0', async ({ page }) => {
    await open(page, ['tailDown/sideMarkUp', 'sideMarkUp/sideMarkUp', 'tangled']);
    await startTable(page, ['Kat', 'Ash']);
    await takeWolves(page, 'Kat');
    await page.getByRole('button', { name: 'Roll' }).click();
    await page.getByRole('button', { name: 'Bank 25' }).click();
    await takeWolves(page, 'Ash');
    await page.getByRole('button', { name: 'Roll' }).click();
    await page.getByRole('button', { name: 'Bank 1' }).click();
    await takeWolves(page, 'Kat');
    await page.getByRole('button', { name: 'Roll' }).click();
    await expect(page.locator('.handover__summary'), 'Then the band reports the tangle').toHaveText('Tangled! Kat loses 25 and drops to 0.');
    await expect(page.getByRole('img', { name: /Kat 0, Ash 1/ }), 'Then the trail shows Kat back at 0').toBeVisible();
  });
});

test.describe('Feature: winning', () => {
  test('Scenario: Given a race to 50, When Kat banks a Double Howl, Then Kat wins', async ({ page }) => {
    await open(page, ['tailDown/tailDown']);
    await startTable(page, ['Kat', 'Ash'], 'First to 50');
    await takeWolves(page, 'Kat');
    await page.getByRole('button', { name: 'Roll' }).click();
    await page.getByRole('button', { name: 'Bank 100' }).click();
    await expect(page.getByRole('heading', { name: 'Kat wins!' }), 'Then Kat is declared the winner').toBeVisible();
    await expect(page.locator('.handover .card__total.is-winner'), 'Then the final score card marks 100').toHaveText('100');
  });

  test('Scenario: Given Kat lands the Alpha, Then the winner cutscene plays, can be skipped, and Kat wins', async ({ page }) => {
    await open(page, ['alpha'], '&winner=1');
    await startTable(page, ['Kat', 'Ash']);
    await takeWolves(page, 'Kat');
    await page.getByRole('button', { name: 'Roll' }).click();
    const scene = page.getByRole('dialog', { name: 'Kat wins', exact: true });
    await expect(scene, 'Then the winner cutscene plays').toBeVisible();
    await page.keyboard.press('Space');
    await expect(scene, 'Then Space skips it').toBeHidden();
    await expect(page.getByRole('heading', { name: 'Kat wins!' }), 'Then the final band declares Kat the winner').toBeVisible();
    await expect(page.locator('.handover .card__total.is-winner'), 'Then the Alpha lifts Kat to the target').toHaveText('100');
  });

  test('Scenario: Given solo play against the computer, When the computer banks past the target, Then the computer wins', async ({ page }) => {
    await open(page, ['upright/sideMarkUp', 'tailDown/tailDown']);
    await page.getByLabel('Race').selectOption({ label: 'First to 50' });
    await page.getByRole('button', { name: 'Deal the wolves' }).click();
    await expect(page.getByRole('heading', { name: 'Your turn' }), 'Then the human seat is addressed as You').toBeVisible();
    await page.getByRole('button', { name: 'Take the wolves' }).click();
    await page.getByRole('button', { name: 'Roll' }).click();
    await page.getByRole('button', { name: 'Bank 5' }).click();
    await expect(page.getByRole('heading', { name: 'Ember wins!' }), 'Then the computer rolls, banks and wins on its own').toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Feature: keyboard play', () => {
  test('Scenario: Given the handover band, When Kat uses only the keyboard, Then she can take, throw and bank', async ({ page }) => {
    await open(page, ['noseDown/sideMarkDown']);
    await startTable(page, ['Kat', 'Ash']);
    await page.keyboard.press('Escape');
    await page.locator('body').focus();
    await page.keyboard.press('Space');
    await expect(handover(page), 'Then Space takes the wolves').toBeHidden();
    await page.locator('body').focus();
    await page.keyboard.press('Space');
    await expect(pot(page), 'Then one press of Space auto-rolls for a Sniff').toHaveText('10');
    await page.keyboard.press('b');
    await expect(page.getByRole('heading', { name: "Ash's turn" }), 'Then B banks and passes the wolves').toBeVisible();
  });
});

test.describe('Feature: choosing wolves', () => {
  test('Scenario: Given the setup sheet, When Kat opens the animal picker, Then every carved animal is choosable and the last card is coming soon', async ({ page }) => {
    await open(page, []);
    await page.getByRole('button', { name: /Seat 1 animal/ }).click();
    const den = page.getByRole('dialog', { name: /pick your animal/ });
    const focus = den.locator('.wolfcard.is-focus');
    await expect(den, 'Then the animal picker opens').toBeVisible();
    await expect(den.getByRole('button', { name: 'Previous animal' }), 'Then the first card has nothing before it').toBeDisabled();
    await expect(focus, 'Then the first card is the Winter Wolf').toContainText('Winter Wolf');
    for (const name of ['Pig', 'Gorilla', 'Beaver', 'Beaver in a Tuxedo', 'Tortoise']) {
      await den.getByRole('button', { name: 'Next animal' }).click();
      await expect(focus.getByRole('heading'), `Then the next card is the ${name}`).toHaveText(name);
      await expect(focus.getByRole('button', { name: 'Choose' }), `Then the ${name} can be chosen`).toBeEnabled();
    }
    await den.getByRole('button', { name: 'Next animal' }).click();
    await expect(focus, 'Then the last card is coming soon').toContainText('Coming soon');
    await expect(focus.getByRole('button', { name: 'Locked' }), 'Then the coming soon card is locked').toBeDisabled();
    await den.getByRole('button', { name: 'Previous animal' }).click();
    await focus.getByRole('button', { name: 'Choose' }).click();
    await expect(den, 'Then choosing closes the picker').toBeHidden();
    await expect(page.getByRole('button', { name: /Seat 1 animal: Tortoise/ }), 'Then seat 1 throws the Tortoise').toBeVisible();
  });

  test('Scenario: Given two seats, When Kat picks Glacier for seat 1, Then seat 2 cannot take Glacier', async ({ page }) => {
    await open(page, []);
    await page.getByRole('radiogroup', { name: 'Seat 1 collar colour' }).getByRole('radio', { name: 'Glacier' }).check();
    await expect(page.getByRole('radiogroup', { name: 'Seat 1 collar colour' }).getByRole('radio', { name: 'Glacier' }), 'Then seat 1 wears Glacier').toBeChecked();
    await expect(page.getByRole('radiogroup', { name: 'Seat 2 collar colour' }).getByRole('radio', { name: 'Glacier' }), 'Then Glacier is taken for seat 2').toBeDisabled();
  });
});
