import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const host = (page: Page) => page.locator('.cinema-canvas');
async function at(page: Page, id: string, local = .64) {
  const ids = await page.locator('.story-step').evaluateAll(elements => elements.map(element => element.id));
  expect(ids).toContain(id);
  const value = ids.indexOf(id) + local;
  await page.getByRole('slider', { name: 'Posición en el recorrido', exact: true }).evaluate((element, requested) => {
    (element as HTMLInputElement).value = String(requested);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await expect(host(page)).toHaveAttribute('data-stage-id', id);
  await expect.poll(async () => Math.abs(Number(await host(page).getAttribute('data-progress')) - value)).toBeLessThan(.002);
}

test('Arecibo LF and phased ALMA HF have different instruments, routes and DM semantics', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?qa=1&still=1');
  await expect(host(page)).toHaveAttribute('data-observation', 'arecibo-lf');
  await at(page, 'tierra');
  await expect(page.locator('.caption')).toContainText('Puerto Rico');
  await expect(page.locator('.provenance').first()).toContainText('ARECIBO');
  await at(page, 'antenas');
  await expect(page.locator('.story-copy h2')).toContainText('Un receptor');
  await expect(page.locator('.math-panel')).not.toContainText('Retardo geometrico');
  await mkdir('validation/screenshots', { recursive: true });
  await page.screenshot({ path: `validation/screenshots/observations-${info.project.name}-arecibo.png` });
  await page.getByRole('combobox', { name: 'Caso de observación' }).selectOption('alma-hf');
  await expect(host(page)).toHaveAttribute('data-observation', 'alma-hf');
  await expect(page.locator('.story-step')).toHaveCount(18);
  await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', '0');
  const ids = await page.locator('.story-step').evaluateAll(elements => elements.map(element => element.id));
  expect(ids).not.toContain('anfitriona'); expect(ids).not.toContain('bowtie'); expect(ids).not.toContain('centernet');
  expect(ids).toContain('fase'); expect(ids).toContain('suma');
  await at(page, 'tierra');
  await expect(page.locator('.story-copy h2')).toContainText('Chajnantor');
  await at(page, 'antenas');
  await page.screenshot({ path: `validation/screenshots/observations-${info.project.name}-alma.png` });
  await at(page, 'hf-resolution');
  expect(Number(await host(page).getAttribute('data-resolution-ratio'))).toBeCloseTo(.018344957066, 11);
  await expect(page.locator('.story-copy h2')).toContainText('no resuelta');
  await expect(page.locator('.math-panel')).toContainText(/4[.,]096/);
  await page.getByRole('button', { name: 'Ver evidencia y fuentes', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('1.385411');
  await expect(page.getByRole('dialog')).not.toContainText('Score CenterNet');
  await page.getByRole('button', { name: 'Cerrar evidencia', exact: true }).click();
  expect(errors).toEqual([]);
});

test('HF plots build and stay linked without inheriting LF network scores', async ({ page }, info) => {
  const errors: string[] = []; const evidenceRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/evidence/')) evidenceRequests.push(request.url()); });
  await page.goto('/?qa=1&still=1&observation=alma-hf&detector=cnn&classifier=resnet');
  await expect(host(page)).toHaveAttribute('data-ready', 'true');
  for (const id of ['hf-resolution', 'hf-matriz', 'hf-profile', 'hf-boxcar']) {
    await at(page, id, .2);
    const before = Number(await host(page).getAttribute('data-completed'));
    await at(page, id, .64);
    expect(Number(await host(page).getAttribute('data-completed')), id).toBeGreaterThan(before);
  }
  await at(page, 'hf-candidato');
  const panel = page.locator('.hf-finale');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-mode', 'hf');
  await expect(panel).toContainText(/DM no resuelta/i);
  await expect(panel).not.toContainText('CenterNet');
  await expect(panel).not.toContainText('67,82');
  await expect(panel.locator('canvas')).toHaveCount(3);
  const profile = panel.locator('canvas[data-kind="profile"]');
  const selected = Number(await profile.getAttribute('data-selected-time'));
  await profile.press('ArrowRight');
  const next = Number(await profile.getAttribute('data-selected-time'));
  expect(next).toBeGreaterThan(selected);
  for (const canvas of await panel.locator('canvas').all()) {
    expect(Number(await canvas.getAttribute('data-selected-time'))).toBe(next);
    const drawn = await canvas.evaluate(element => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let visible = 0;
      for (let i = 0; i < pixels.length; i += 16) if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 80) visible++;
      return visible;
    });
    expect(drawn).toBeGreaterThan(40);
  }
  const threshold = page.getByRole('slider', { name: 'Umbral SNR HF', exact: true });
  await threshold.focus(); await page.keyboard.press('End');
  await expect(panel).toHaveAttribute('data-accepted', 'false');
  await expect(panel).toContainText('Sin propuesta a este umbral');
  expect(Number(await profile.getAttribute('data-selected-time'))).toBe(next);
  await page.keyboard.press('Home');
  await expect(panel).toHaveAttribute('data-accepted', 'true');
  await page.screenshot({ path: `validation/screenshots/observations-${info.project.name}-hf-final.png` });
  await at(page, 'hf-candidato', .2);
  expect(Number(await profile.getAttribute('data-completed'))).toBeLessThan(128);
  await page.getByRole('combobox', { name: 'Caso de observación' }).selectOption('arecibo-lf');
  await expect(page.locator('.hf-finale')).toHaveCount(0);
  await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', '0');
  expect(evidenceRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('changing observation aborts LF evidence and keeps compact case control accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/evidence/metadata.json', async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.continue().catch(() => {});
  });
  await page.goto('/?qa=1&still=1&detector=cnn&classifier=resnet');
  await expect(host(page)).toHaveAttribute('data-ready', 'true');
  await at(page, 'antenas');
  await page.getByRole('combobox', { name: 'Caso de observación' }).selectOption('alma-hf');
  await expect(host(page)).toHaveAttribute('data-observation', 'alma-hf');
  await page.waitForTimeout(800);
  await expect(host(page)).toHaveAttribute('data-evidence', 'idle');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await at(page, 'hf-candidato');
  await expect(page.locator('.hf-finale')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = await page.evaluate(() => {
    const panel = document.querySelector('.hf-finale')!.getBoundingClientRect();
    return { top: panel.top, bottom: panel.bottom,
      headerBottom: document.querySelector('.site-header')!.getBoundingClientRect().bottom,
      flowTop: document.querySelector('.event-flow')!.getBoundingClientRect().top,
      chartBottoms: Array.from(document.querySelectorAll('.hf-finale canvas'), element => element.getBoundingClientRect().bottom) };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.headerBottom);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.flowTop);
  expect(bounds.chartBottoms.every(bottom => bottom <= bounds.bottom)).toBe(true);
});

test('HF reduced motion and WebGL fallback retain the chosen case without LF posterior plots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, options?: unknown) {
      if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
      return original.call(this, kind as '2d', options as CanvasRenderingContext2DSettings);
    } as typeof original;
  });
  await page.goto('/?qa=1&observation=alma-hf');
  await expect(page.locator('.poster-surface')).toBeVisible();
  await page.getByRole('slider', { name: 'Posición en el recorrido', exact: true }).evaluate(element => {
    (element as HTMLInputElement).value = '7.6';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('.poster-surface img')).toHaveAttribute('src', /alma-hf-antenas\.jpg/);
  await expect.poll(async () => page.locator('.poster-surface img').evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Ir a Métodos', exact: true }).click();
  await expect(page.locator('.hf-finale')).toBeVisible();
  await expect(page.locator('.hf-finale')).toHaveAttribute('data-dm-status', 'unresolved_high_freq');
  await expect(page.locator('.hf-finale')).not.toContainText('CenterNet');
});
