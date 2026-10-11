import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const host = (page: Page) => page.locator('.cinema-canvas');
const position = (page: Page) => page.getByRole('slider', { name: 'Posición en el recorrido', exact: true });
async function at(page: Page, id: string, local: number) {
  const ids = await page.locator('.story-step').evaluateAll(elements => elements.map(element => element.id));
  const value = ids.indexOf(id) + local;
  expect(value).toBeGreaterThanOrEqual(0);
  await position(page).evaluate((element, requested) => {
    (element as HTMLInputElement).value = String(requested);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await expect.poll(async () => Math.abs(Number(await host(page).getAttribute('data-progress')) - value)).toBeLessThan(.002);
  await expect(host(page)).toHaveAttribute('data-stage-id', id);
}
async function open(page: Page, recorded = false) {
  await page.goto(`/?qa=1&still=1${recorded ? '&detector=cnn&classifier=resnet' : '&detector=boxcar&classifier=radio'}`);
  await expect(host(page)).toHaveAttribute('data-ready', 'true');
  await mkdir('validation/screenshots', { recursive: true });
}

test('camera follows Galactic entry and descends to the Chajnantor array reversibly', async ({ page }, info) => {
  await page.goto('/?qa=1&still=1&observation=alma-hf');
  await expect(host(page)).toHaveAttribute('data-ready', 'true');
  await mkdir('validation/screenshots', { recursive: true });
  for (const id of ['galaxia', 'tierra']) {
    await at(page, id, .08);
    const far = Number(await host(page).getAttribute('data-camera-distance'));
    await at(page, id, .55);
    const close = Number(await host(page).getAttribute('data-camera-distance'));
    expect(close).toBeLessThan(far * .75);
    await page.screenshot({ path: `validation/screenshots/journey-${info.project.name}-${id}-inside.png` });
    const endPose = await host(page).getAttribute('data-camera-target');
    await at(page, id, .08);
    expect(Number(await host(page).getAttribute('data-camera-distance'))).toBeCloseTo(far, 2);
    await at(page, id, .55);
    expect(await host(page).getAttribute('data-camera-target')).toBe(endPose);
  }
  await at(page, 'tierra', .64);
  await expect(host(page)).toHaveAttribute('data-received-count', '6');
  await expect(host(page)).toHaveAttribute('data-asset-ready', 'true');
  await expect(host(page)).toHaveAttribute('data-travel-phase', 'valle de Chajnantor');
  await page.screenshot({ path: `validation/screenshots/journey-${info.project.name}-chajnantor.png` });
  await at(page, 'antenas', .6);
  await expect(page.locator('.math-panel')).toContainText(/ALMA/i);
  await page.screenshot({ path: `validation/screenshots/journey-${info.project.name}-antenas.png` });
});

test('animated electron column renders integral and scripts rather than an ASCII approximation', async ({ page }, info) => {
  await open(page);
  await at(page, 'plasma', .6);
  const formulas = JSON.parse((await host(page).getAttribute('data-formulas'))!);
  expect(formulas.some((formula: string) => formula.includes('\\int') && formula.includes('n_e'))).toBe(true);
  expect(formulas.join(' ')).not.toContain('sum n_e');
  await page.locator('.math-terms button').filter({ hasText: 'DM' }).click();
  await expect(page.locator('.math-equation .katex')).toBeVisible();
  await page.screenshot({ path: `validation/screenshots/journey-${info.project.name}-dm-formula.png` });
});

test('finale constructs three linked plots and separates model class from confirmation', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page, true);
  await at(page, 'candidato', .64);
  await expect(host(page)).toHaveAttribute('data-evidence', 'verified');
  const panel = page.locator('.finale-panel');
  await expect(panel).toHaveAttribute('data-mode', 'recorded');
  await expect(panel).toContainText('Candidato detectado.');
  await expect(panel).toContainText('Para confirmar: descartar RFI y contrastar evidencia astronómica independiente.');
  await expect(panel.locator('canvas')).toHaveCount(3);
  await expect(panel).toContainText('67,82');
  await expect(panel).toContainText('ResNet');
  await expect(panel).toContainText('MHz');
  const profile = panel.locator('.finale-chart-profile canvas');
  const selected = Number(await profile.getAttribute('data-selected-time'));
  await profile.press('ArrowRight');
  const next = Number(await profile.getAttribute('data-selected-time'));
  expect(next).toBeGreaterThan(selected);
  for (const canvas of await panel.locator('canvas').all()) {
    expect(Number(await canvas.getAttribute('data-selected-time'))).toBe(next);
    const pixels = await canvas.evaluate(element => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let colored = 0;
      for (let n = 0; n < pixels.length; n += 16) {
        if (Math.max(pixels[n], pixels[n + 1], pixels[n + 2]) > 80) colored++;
      }
      return colored;
    });
    expect(pixels).toBeGreaterThan(40);
  }
  await page.getByRole('button', { name: 'Restaurar selección del candidato' }).click();
  expect(Number(await profile.getAttribute('data-selected-time'))).toBe(selected);
  await page.screenshot({ path: `validation/screenshots/journey-${info.project.name}-finale-recorded.png` });
  const completed = await profile.getAttribute('data-completed');
  await at(page, 'candidato', .2);
  expect(Number(await profile.getAttribute('data-completed'))).toBeLessThan(Number(completed));
  await at(page, 'candidato', .64);
  expect(await profile.getAttribute('data-completed')).toBe(completed);
  expect(errors).toEqual([]);
});

test('didactic finale remains readable in compact viewports without inherited scores', async ({ page }, info) => {
  for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await open(page);
    await at(page, 'candidate-didactic', .64);
    const panel = page.locator('.finale-panel');
    await expect(panel).toHaveAttribute('data-mode', 'didactic');
    await expect(panel).toContainText('sin inferencia entrenada');
    await expect(panel).not.toContainText('67,82');
    const bounds = await page.evaluate(() => {
      const panel = document.querySelector('.finale-panel')!.getBoundingClientRect();
      const header = document.querySelector('.site-header')!.getBoundingClientRect();
      const flow = document.querySelector('.event-flow')!.getBoundingClientRect();
      const identity = document.querySelector('.event-identity')!.getBoundingClientRect();
      const charts = Array.from(document.querySelectorAll('.finale-chart canvas'), element => element.getBoundingClientRect().height);
      return { top: panel.top, headerBottom: header.bottom, bottom: panel.bottom, flowTop: Math.min(flow.top, identity.top), charts,
        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    expect(bounds.top).toBeGreaterThanOrEqual(bounds.headerBottom);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.flowTop);
    expect(bounds.charts.every(height => height >= 34)).toBe(true);
    expect(bounds.overflow).toBe(false);
    await page.screenshot({ path: `validation/screenshots/journey-${info.project.name}-finale-${size.width}.png` });
  }
});
