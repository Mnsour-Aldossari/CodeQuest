import { expect, type Page } from '@playwright/test';

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

export async function openLevel(page: Page, id: string) {
  await page.goto(`/#/level/${id}`);
  await page.getByTestId('run').waitFor();
  // the first-level tour
  const next = page.getByTestId('tour-next');
  if (await next.isVisible({ timeout: 1500 }).catch(() => false)) {
    for (let i = 0; i < 4; i++) await next.click();
  }
}

/** Tap a palette block (opening the drawer on mobile). */
export async function pick(page: Page, index: number) {
  if (isMobile(page)) await page.locator('[data-mtab="blocks"]').click();
  await page.locator(`[data-palette="${index}"]`).click();
}

export async function placeAt(page: Page, gap: string) {
  await page.locator(`[data-gap="${gap}"]`).click();
}

export async function run(page: Page) {
  await page.getByTestId('run').click();
}

export async function expectWin(page: Page) {
  await expect(page.getByRole('dialog').filter({ has: page.getByTestId('win-next') })).toBeVisible({ timeout: 10_000 });
}
