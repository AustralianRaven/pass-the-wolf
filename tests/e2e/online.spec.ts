import { expect, test, type Page } from '@playwright/test';

/**
 * Local network play (#2) between two real browser contexts: a WebRTC connection made by
 * swapping codes, with no relay and no internet. Chromium hides local addresses behind mDNS
 * names by default; this flag shows them, as a LAN game between two devices would see them.
 */
test.use({ launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] } });

const ready = async (page: Page, query: string) => {
  await page.goto(`/${query}`);
  await expect(page.locator('html'), 'Then the table has finished loading').toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
};

const lobbyAs = async (page: Page, name: string) => {
  await page.getByRole('button', { name: 'Play with friends', exact: true }).click();
  const lobby = page.getByRole('dialog', { name: 'Play with friends' });
  await expect(lobby, 'Then the lobby opens').toBeVisible();
  await lobby.getByLabel('Name').fill(name);
  await lobby.getByText('Local network', { exact: true }).click();
  return lobby;
};

test('Scenario: Given two devices on one network, When they swap codes and play a turn, Then both tables show the same game', async ({ browser }) => {
  test.setTimeout(150_000);
  const kat = await (await browser.newContext()).newPage();
  const ash = await (await browser.newContext()).newPage();
  // Kat's throws land on a Sniff (10); Ash plays normally.
  await ready(kat, '?fast=1&force=noseDown/sideMarkDown');
  await ready(ash, '?fast=1');

  const hostLobby = await lobbyAs(kat, 'Kat');
  await hostLobby.getByRole('button', { name: 'Host on this device' }).click();
  await hostLobby.getByRole('button', { name: 'Invite a player' }).click();
  const invite = hostLobby.getByRole('textbox', { name: 'Invite code (send to one friend)' });
  await expect(invite, 'Then Kat gets an invite code').not.toHaveValue('', { timeout: 10_000 });

  const guestLobby = await lobbyAs(ash, 'Ash');
  await guestLobby.getByRole('button', { name: 'Join a host' }).click();
  await guestLobby.getByRole('textbox', { name: "Paste the host's invite code" }).fill(await invite.inputValue());
  await guestLobby.getByRole('button', { name: 'Make my reply code' }).click();
  const reply = guestLobby.getByRole('textbox', { name: 'Your reply code (send back to the host)' });
  await expect(reply, 'Then Ash gets a reply code').not.toHaveValue('', { timeout: 10_000 });

  await hostLobby.getByRole('textbox', { name: 'Paste their reply code' }).fill(await reply.inputValue());
  await hostLobby.getByRole('button', { name: 'Connect' }).click();
  await expect(hostLobby.locator('.lobby__player'), 'Then Kat sees two players').toHaveCount(2, { timeout: 15_000 });
  await expect(guestLobby.locator('.lobby__player'), 'Then Ash sees two players').toHaveCount(2);

  await hostLobby.getByRole('button', { name: 'Deal the wolves' }).click();
  for (const page of [kat, ash]) await expect(page.getByRole('heading', { name: "Kat's turn" }), 'Then both tables hand Kat the wolves').toBeVisible();
  await expect(ash.getByRole('button', { name: 'Waiting for Kat…' }), 'Then Ash cannot take Kat’s turn').toBeDisabled();

  await kat.getByRole('button', { name: 'Take the wolves' }).click();
  await expect(kat.locator('.handover'), "Then Kat's band clears").toBeHidden();
  await expect(ash.locator('.handover'), "Then Ash's band clears too").toBeHidden();

  await kat.getByRole('button', { name: 'Auto-roll' }).click();
  for (const page of [kat, ash]) await expect(page.locator('.plate__pot dd'), 'Then both tables show the Sniff in the pot').toHaveText('10');

  await kat.getByRole('button', { name: 'Bank 10' }).click();
  for (const page of [kat, ash]) await expect(page.getByRole('heading', { name: "Ash's turn" }), 'Then both tables pass the wolves to Ash').toBeVisible();
  await expect(kat.getByRole('button', { name: 'Waiting for Ash…' }), 'Then Kat waits for Ash').toBeDisabled();
  await ash.getByRole('button', { name: 'Take the wolves' }).click();
  await expect(kat.locator('.handover'), "Then Ash taking the wolves clears Kat's band").toBeHidden();
});
