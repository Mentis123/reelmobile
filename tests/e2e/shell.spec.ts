import { expect, type BrowserContext, test } from '@playwright/test';

async function openRoute(context: BrowserContext, path: string) {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.goto(path, { waitUntil: 'domcontentloaded' });

  return { errors, page };
}

test('M0 shell routes load', async ({ context }) => {
  const home = await openRoute(context, '/');
  const homePage = home.page;
  await expect(homePage.getByRole('heading', { name: 'Reel Mobile' })).toBeVisible();
  await expect(homePage.getByText('Tap to begin.')).toBeVisible();
  expect(home.errors).toEqual([]);
  await homePage.close();

  const game = await openRoute(context, '/game');
  await expect(game.page.getByTestId('game-route')).toBeVisible();
  expect(game.errors).toEqual([]);
  await game.page.close();

  const tune = await openRoute(context, '/tune');
  await expect(tune.page.getByTestId('tune-route')).toBeVisible();
  expect(tune.errors).toEqual([]);
  await tune.page.close();

  const dev = await openRoute(context, '/dev');
  await expect(dev.page.getByRole('heading', { name: 'Dev Gate' })).toBeVisible();
  await expect(dev.page.getByText('M0 shell gate')).toBeVisible();
  await expect(dev.page.getByText('v0.0-shell-candidate')).toBeVisible();
  expect(dev.errors).toEqual([]);
  await dev.page.close();
});
