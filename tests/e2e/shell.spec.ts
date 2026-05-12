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
  await expect(game.page.getByTestId('tap-to-begin')).toBeVisible();
  expect(game.errors).toEqual([]);
  await game.page.close();

  const tune = await openRoute(context, '/tune');
  await expect(tune.page.getByTestId('tune-route')).toBeVisible();
  expect(tune.errors).toEqual([]);
  await tune.page.close();

  const dev = await openRoute(context, '/dev');
  await expect(dev.page.getByRole('heading', { name: 'Dev Gate' })).toBeVisible();
  await expect(dev.page.getByText('M3.1 fish feel-repair real-iPhone gate')).toBeVisible();
  await expect(dev.page.getByText('v0.3.1-fish-feel-candidate')).toBeVisible();
  expect(dev.errors).toEqual([]);
  await dev.page.close();
});

test('M1 vertical slice smoke', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.goto('/game?debug=1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('tap-to-begin')).toBeVisible();
  await page.getByTestId('tap-to-begin').tap();
  await expect(page.getByTestId('tap-to-begin')).toBeHidden();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('debug-hud')).toBeVisible();
  await expect(page.getByTestId('game-route')).toHaveAttribute('data-webgl-handlers', 'ready');
  await expect(page.getByTestId('game-route')).toHaveAttribute('data-game-state', 'scouting');

  await page.waitForFunction(() => {
    const hud = document.querySelector('[data-testid="debug-hud"]');
    const match = hud?.textContent?.match(/FPS\s+(\d+)/);
    return match ? Number(match[1]) > 0 : false;
  });

  const canvasDataUrl = await page.locator('canvas').evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  expect(canvasDataUrl.length).toBeGreaterThan(1000);

  const box = await page.getByTestId('game-route').boundingBox();
  expect(box).not.toBeNull();

  if (box) {
    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.84;
    const endX = box.x + box.width * 0.38;
    const endY = box.y + box.height * 0.48;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 8 });
    await page.mouse.up();
  }

  await page.waitForFunction(() => {
    const state = document.querySelector('[data-testid="game-route"]')?.getAttribute('data-game-state');
    return state === 'casting' || state === 'lure_idle';
  });
  await page.waitForFunction(() => document.querySelector('[data-testid="game-route"]')?.getAttribute('data-game-state') === 'lure_idle');

  const rodBox = await page.locator('.line-overlay path').boundingBox();
  expect(rodBox).not.toBeNull();

  if (rodBox) {
    const rodX = rodBox.x + rodBox.width * 0.55;
    const rodY = rodBox.y + rodBox.height * 0.55;
    await page.mouse.move(rodX, rodY);
    await page.mouse.down();
    await page.mouse.move(rodX - 70, rodY - 60, { steps: 6 });
    await expect(page.getByTestId('game-route')).toHaveAttribute('data-game-state', 'rod_control');
    await page.mouse.up();
    await expect(page.getByTestId('game-route')).toHaveAttribute('data-game-state', 'lure_idle');
  }

  expect(errors).toEqual([]);
});
