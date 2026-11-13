import { expect, test } from '@playwright/test';

test.describe('Feature: app shell', () => {
  test('Scenario: Given the site loads, Then the Pass the Wolf wordmark is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page, 'Then the document title names the game').toHaveTitle('Pass the Wolf');
    await expect(page.getByRole('heading', { level: 1 }), 'Then the wordmark heading is shown').toContainText('Wolf');
  });
});
