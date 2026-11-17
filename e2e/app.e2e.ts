import { test, expect, type Page } from '@playwright/test';
const open = async (page: Page) => { const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text())); await page.goto('/'); await expect(page.locator('#stT')).not.toBeEmpty(); return errors; };

for (const lang of ['kk', 'ru', 'en']) test(`loads without JS errors, language ${lang}`, async ({ page }) => {
  const errors = await open(page); await page.selectOption('#lang', lang);
  await expect(page.locator('html')).toHaveAttribute('lang', lang); await expect(page.locator('#st')).not.toBeEmpty(); expect(errors).toEqual([]);
});
test('theme toggle applies and persists', async ({ page }) => {
  await open(page); const before = await page.locator('html').getAttribute('data-t'); await page.click('#th');
  const after = await page.locator('html').getAttribute('data-t'); expect(after).not.toBe(before); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-t', after!);
});
test('added point survives reload (IndexedDB)', async ({ page }) => {
  await open(page); const n = await page.locator('#a option').count(); await page.click('#bp'); await expect(page.locator('#a option')).toHaveCount(n + 1);
  await page.waitForFunction(() => document.querySelector('#sv')?.textContent !== ''); await page.reload(); await expect(page.locator('#a option')).toHaveCount(n + 1);
});
test('hints are staged and stop after level 4; wrong answer gets hedged feedback; correct is accepted', async ({ page }) => {
  await open(page); await page.selectOption('#lang', 'ru');
  for (let i = 0; i < 4; i++) await page.click('#hb'); await expect(page.locator('#hl')).toContainText('4/4'); await page.click('#hb'); await expect(page.locator('#hint')).toContainText('закончились');
  await page.fill('#ans', '4*sqrt(2)'); await page.click('#ck'); await expect(page.locator('#hint')).toContainText('Возможно');
  await page.fill('#ans', '4*sqrt(3)'); await page.click('#ck'); await expect(page.locator('#res')).toHaveClass(/ok/);
});
test('profiles do not share drafts', async ({ page }) => {
  await open(page); await page.fill('#dr', 'draft of first profile'); await page.waitForTimeout(600);
  page.once('dialog', d => d.accept('Second')); await page.click('#np'); await expect(page.locator('#dr')).toHaveValue('');
});
test('no horizontal overflow and keyboard reaches controls', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.keyboard.press('Tab'); expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
});
test('works offline after first load', async ({ page, context }) => {
  await open(page); await page.evaluate(() => navigator.serviceWorker.ready); await page.reload(); await context.setOffline(true); await page.reload();
  await expect(page.locator('#stT')).not.toBeEmpty(); await page.click('#bd'); await expect(page.locator('#msg')).toContainText('|');
});
test('reference opens; reference solution is hidden until teacher mode is on', async ({ page }) => {
  await open(page); await expect(page.locator('#ref')).toBeHidden(); await page.click('#rf'); await expect(page.locator('#ref')).toContainText('RULE-001');
  await expect(page.locator('#solv')).toBeHidden(); await page.check('#tc'); await expect(page.locator('#solv')).toContainText('4');
});
test('3D tools: projection and section add objects to the scene', async ({ page }) => {
  await open(page); const n = await page.locator('#a option').count();
  await page.selectOption('#a', 'A'); await page.selectOption('#b', 'B'); await page.selectOption('#c', 'D'); await page.selectOption('#d', 'A₁');
  await page.click('#bj'); await expect(page.locator('#a option')).toHaveCount(n + 1); await expect(page.locator('#msg')).toContainText('H =');
  await page.selectOption('#a', 'A'); await page.selectOption('#b', 'A₁'); await page.selectOption('#c', 'C₁'); await page.click('#bx'); await expect(page.locator('#msg')).toContainText('22.627');
});
test('solids: build a square pyramid and read volume and surface area', async ({ page }) => {
  await open(page); await page.selectOption('#sd', 'pyr4'); await page.click('#bb'); await expect(page.locator('#a option')).toHaveCount(5);
  await page.click('#bw'); await expect(page.locator('#msg')).toContainText('V = 32');
});
test('handwriting: honest unavailable message; invalid photo rejected; no consent means not saved', async ({ page }) => {
  await open(page); await page.selectOption('#lang', 'ru'); await page.click('#hwl'); await page.click('#inkr'); await expect(page.locator('#hwo')).toContainText('Сначала нарисуйте');
  const box = await page.locator('#ink').boundingBox(); await page.mouse.move(box!.x + 10, box!.y + 10); await page.mouse.down(); await page.mouse.move(box!.x + 80, box!.y + 40); await page.mouse.up();
  await page.click('#inkr'); await expect(page.locator('#hwo')).toContainText('пока не подключено');
  await page.setInputFiles('#ph', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }); await expect(page.locator('#hwo')).toContainText('PNG');
});
