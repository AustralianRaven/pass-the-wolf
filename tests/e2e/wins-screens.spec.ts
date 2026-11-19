import { expect, test } from '@playwright/test';

test.describe('Feature: the win screens page', () => {
  for (const [scene, label] of [
    ['storm', 'Storm and tornado'],
    ['summit', 'Summit howl'],
    ['lake', 'Frozen lake'],
    ['fireworks', 'Fireworks'],
  ] as const) {
  test(`Scenario: Given four players, When Kat plays the ${scene} scene for player 2, Then it plays and Space skips it`, async ({ page }) => {
    await page.goto('/wins-screens.html');
    await expect(page.locator('html'), 'Then the page has loaded').toHaveAttribute('data-ready', 'true');
    await page.getByLabel('Players').selectOption('4');
    await expect(page.locator('.wins__seat'), 'Then there are four players to set up').toHaveCount(4);
    await page.getByLabel('Player 2 name').fill('Ash');
    await page.getByLabel('Player 2 animal').selectOption({ label: 'Tortoise' });
    await page.getByLabel('Player 2 colour').selectOption({ label: 'Pine' });
    await page.getByLabel('Player 2 wins').check();
    await page.getByLabel('Scene').selectOption({ label });
    await expect(page.getByLabel('Scene'), `Then the ${scene} scene is chosen`).toHaveValue(scene);
    await page.getByRole('button', { name: 'Play' }).click();
    const cutscene = page.getByRole('dialog', { name: 'Ash wins', exact: true });
    await expect(cutscene, 'Then the winner cutscene plays for Ash').toBeVisible();
    await page.keyboard.press('Space');
    await expect(cutscene, 'Then Space skips it').toBeHidden();
    await expect(page.getByRole('button', { name: 'Play' }), 'Then the panel is ready to play again').toBeEnabled();
  });
  }
});
