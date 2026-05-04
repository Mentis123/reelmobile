import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 800, height: 1280 }
] as const;

for (const viewport of viewports) {
  test(`M2 visual canvas renders on ${viewport.name}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/game?debug=1', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('tap-to-begin').tap();
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(1200);

    const screenshotPath = testInfo.outputPath(`m2-${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const pixelStats = await page.locator('canvas').evaluate(async (canvas) => {
      const source = canvas as HTMLCanvasElement;
      const image = new Image();
      image.src = source.toDataURL('image/png');
      await image.decode();

      const sampler = document.createElement('canvas');
      sampler.width = 64;
      sampler.height = 64;
      const ctx = sampler.getContext('2d');
      if (!ctx) {
        return { nonBlankRatio: 0 };
      }

      ctx.drawImage(image, 0, 0, sampler.width, sampler.height);
      const data = ctx.getImageData(0, 0, sampler.width, sampler.height).data;
      let nonBlank = 0;

      for (let index = 0; index < data.length; index += 4) {
        if (data[index] !== 0 || data[index + 1] !== 0 || data[index + 2] !== 0 || data[index + 3] !== 0) {
          nonBlank += 1;
        }
      }

      return { nonBlankRatio: nonBlank / (sampler.width * sampler.height) };
    });

    expect(pixelStats.nonBlankRatio).toBeGreaterThan(0.8);
    expect(errors).toEqual([]);
  });
}
