import { expect, test } from '@playwright/test';
import { expectWin, isMobile, openLevel, pick, placeAt, run } from './helpers';

test('level 1-1 is won by tap-then-place, and progress is saved', async ({ page }) => {
  await openLevel(page, 'html-1');
  await pick(page, 0); // <h1>
  await placeAt(page, 'gap|root|body|0');
  await pick(page, 2); // "مرحبا يا بِت"
  await page.locator('.blk-c .slot').first().click();
  // the live preview shows the heading inside the sandbox
  if (!isMobile(page)) await expect(page.frameLocator('[data-testid="preview-host"] iframe').locator('h1')).toHaveText('مرحبا يا بِت');
  await run(page);
  await expectWin(page);
  await expect(page.getByTestId('learned-card')).toBeVisible();
  await page.getByTestId('win-next').click();
  await expect(page).toHaveURL(/level\/html-2/);
  await page.goto('/#/map');
  await expect(page.locator('[data-node="html-1"]')).toHaveClass(/done/);
  await expect(page.locator('[data-node="html-2"]')).toHaveClass(/cur/);
});

test('a wrong tag turns its block red with a reason in Arabic', async ({ page }) => {
  await openLevel(page, 'html-2');
  await pick(page, 2); // <h7>
  await placeAt(page, 'gap|root|body|0');
  await run(page);
  await expect(page.getByTestId('bit-says')).toContainText('h7');
  await expect(page.locator('.blk.is-error')).toHaveCount(1);
  await expect(page.locator('[data-goal="on"]')).toHaveCount(0);
});

test('hints: text, then glow, then a placed block; hint costs the third star', async ({ page }) => {
  await openLevel(page, 'html-2');
  const hint = page.getByTestId('hint');
  await hint.click();
  await expect(page.getByTestId('bit-says')).toContainText('<h1>');
  await hint.click();
  if (isMobile(page)) await page.locator('[data-mtab="blocks"]').click();
  await expect(page.locator('[data-palette="0"]')).toHaveClass(/is-exec/);
  if (isMobile(page)) await page.locator('[data-mtab="build"]').click();
  await hint.click();
  await expect(page.locator('[data-block]')).not.toHaveCount(0);
});

test('parsons: reorder by drag, then undo with Ctrl+Z', async ({ page }) => {
  test.skip(isMobile(page), 'drag is a desktop interaction; mobile uses tap-then-place');
  await openLevel(page, 'html-3');
  const topLevel = async () => (await page.locator('.cb').first().locator(':scope > div > .ws-line').allInnerTexts()).map((t) => (t.includes('<ul>') ? 'ul' : 'h2'));
  await expect.poll(topLevel).toEqual(['ul', 'h2']);
  // drag the <ul> by its header to the end of <body>
  const ulHead = page.locator('.blk-c[data-block] > .ch').filter({ hasText: '<ul>' }).first();
  await ulHead.scrollIntoViewIfNeeded();
  const a = (await ulHead.boundingBox())!;
  await page.mouse.move(a.x + 20, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 40, a.y + a.height / 2 + 10, { steps: 5 });
  const end = page.locator('[data-gap="gap|root|body|2"]');
  await end.scrollIntoViewIfNeeded();
  const b = (await end.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(topLevel).toEqual(['h2', 'ul']);
  await page.keyboard.press('Control+z');
  await expect.poll(topLevel).toEqual(['ul', 'h2']);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(topLevel).toEqual(['h2', 'ul']);
});

test('nested placement by tapping: move a list item inside its list', async ({ page }) => {
  await openLevel(page, 'html-3');
  // tap the third item (عمر) then tap the gap before the first item
  await page.locator('.blk[data-block]').filter({ hasText: 'عمر' }).first().locator('.tx').first().click(); // the "<li>" part, not the text chip
  const ul = await page.locator('[data-block]').filter({ hasText: '<ul>' }).first().getAttribute('data-block');
  await page.locator(`[data-gap="gap|${ul}|items|0"]`).click();
  await expect(page.locator(`[data-block="${ul}"] .cb [data-block]`).first()).toContainText('عمر');
});

test('boss level: attack payloads are stripped and the sandbox cannot reach the app', async ({ page }) => {
  test.skip(isMobile(page), 'typing a page is covered on desktop');
  await openLevel(page, 'html-5');
  await page.locator('.cm-content').first().click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(`<h1>بيت بِت</h1><img src=x onerror="parent.document.body.dataset.pwned='1'"><script>parent.document.body.dataset.pwned='1'</script><iframe src="https://example.com"></iframe>`);
  await run(page);
  await expect(page.getByTestId('bit-says')).toContainText('صور');
  await page.waitForTimeout(500);
  await expect(page.locator('body')).not.toHaveAttribute('data-pwned', '1');
  const frame = page.locator('[data-testid="preview-host"] iframe');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.frameLocator('[data-testid="preview-host"] iframe').locator('script, iframe, [onerror]')).toHaveCount(0);
});

test('boss level: writing the page by hand wins', async ({ page }) => {
  test.skip(isMobile(page), 'typing a page is covered on desktop');
  await openLevel(page, 'html-5');
  await page.locator('.cm-content').first().click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(`<h1>بيت بِت</h1>\n<ul><li>ليلى</li><li>عمر</li><li>بِت</li></ul>\n<a href="https://developer.mozilla.org">موقعي</a>`);
  await run(page);
  await expectWin(page);
});
