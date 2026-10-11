import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const host = (page: Page) => page.locator('.cinema-canvas');
const position = (page: Page) => page.getByRole('slider', { name: 'Posición en el recorrido', exact: true });
const detector = (page: Page) => page.getByRole('combobox', { name: 'Método de detección', exact: true });
const classifier = (page: Page) => page.getByRole('combobox', { name: 'Método de clasificación', exact: true });

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

async function routeIds(page: Page) {
  return page.locator('.story-step[data-story-id]').evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.storyId!));
}

async function setPosition(page: Page, value: number) {
  await position(page).evaluate((element, progress) => {
    (element as HTMLInputElement).value = String(progress);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await expect.poll(async () => Math.abs(Number(await host(page).getAttribute('data-progress')) - value)).toBeLessThan(.002);
}

async function stage(page: Page, id: string, local = .4) {
  const ids = await routeIds(page);
  const index = ids.indexOf(id);
  expect(index, `${id} belongs to the selected route`).toBeGreaterThanOrEqual(0);
  await setPosition(page, index + local);
  await expect(host(page)).toHaveAttribute('data-stage-id', id);
  await page.waitForTimeout(100);
}

async function open(page: Page, query = '') {
  await page.goto(`/?qa=1&still=1${query}`);
  await host(page).locator('canvas').waitFor();
  await expect(host(page)).toHaveAttribute('data-ready', 'true');
  await mkdir('validation/screenshots', { recursive: true });
}

async function coloredPixels(page: Page) {
  const hide = await page.addStyleTag({ content: '.scene-shade,.site-header,.explanation-stack,.story-copy,.scientific-readout,.act-navigation,.journey-footer,.event-flow,.next-hint,.transport-bar,.method-switcher,.finale-panel{visibility:hidden!important}' });
  const frame = await host(page).locator('canvas').screenshot();
  await hide.evaluate(element => element.parentNode?.removeChild(element));
  return page.evaluate(async encoded => {
    const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      const rgb = [pixels[index], pixels[index + 1], pixels[index + 2]];
      if (Math.max(...rgb) > 45 && Math.max(...rgb) - Math.min(...rgb) > 18) colored++;
    }
    return colored;
  }, frame.toString('base64'));
}

test('precision transport follows clicks, holds, cancellation, slider, keyboard and horizontal wheel', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  await expect(page.locator('h1')).toHaveText('FRB Atlas');
  await page.locator('.math-terms button').first().click();
  const focusedTerm = await page.locator('.math-panel').getAttribute('data-term');
  await setPosition(page, .33);
  await expect(host(page)).toHaveAttribute('data-stage-id', 'faro');
  await expect(host(page)).toHaveAttribute('data-focus', focusedTerm!);
  await expect(page.locator('.math-panel')).toHaveAttribute('data-mode', 'manual');

  const forward = page.getByRole('button', { name: 'Avanzar con precisión', exact: true });
  await forward.click();
  await expect.poll(async () => Math.abs(Number(await host(page).getAttribute('data-progress')) - .3425)).toBeLessThan(.002);
  await expect(host(page)).toHaveAttribute('data-stage-id', 'faro');
  const bounds = (await forward.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  const beforeHold = Number(await host(page).getAttribute('data-progress'));
  await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
  await page.waitForTimeout(300);
  const released = Number(await host(page).getAttribute('data-progress'));
  expect(released - beforeHold).toBeGreaterThan(.03);
  expect(released - beforeHold).toBeLessThan(.15);
  await page.waitForTimeout(350);
  expect(Number(await host(page).getAttribute('data-progress'))).toBeCloseTo(released, 3);

  await page.mouse.down(); await page.waitForTimeout(400);
  await forward.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true });
  await page.waitForTimeout(300);
  const cancelled = Number(await host(page).getAttribute('data-progress'));
  await page.waitForTimeout(350);
  expect(Number(await host(page).getAttribute('data-progress'))).toBeCloseTo(cancelled, 3);
  await page.mouse.up();

  await setPosition(page, .33);
  await position(page).focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Math.abs(Number(await host(page).getAttribute('data-progress')) - .3425)).toBeLessThan(.002);
  await page.keyboard.press('PageDown');
  // Native scroll positions quantize to CSS pixels, including sequential range-key inputs.
  await expect.poll(async () => Math.abs(Number(await host(page).getAttribute('data-progress')) - .4425)).toBeLessThan(.002);
  await page.keyboard.press('Home');
  await expect.poll(async () => Number(await host(page).getAttribute('data-progress'))).toBe(0);
  await page.keyboard.press('End');
  const count = (await routeIds(page)).length;
  await expect.poll(async () => Number(await host(page).getAttribute('data-progress'))).toBeCloseTo(count - .000001, 3);
  await setPosition(page, .33);
  await page.locator('.wordmark').focus();
  const wheelStart = Number(await host(page).getAttribute('data-progress'));
  await page.mouse.wheel(12, 0);
  // Wait for the smoothed forward impulse before testing a symmetric reverse impulse.
  await expect.poll(async () => Math.abs(Number(await host(page).getAttribute('data-progress')) - wheelStart - .01)).toBeLessThan(.0005);
  const wheeled = Number(await host(page).getAttribute('data-progress'));
  expect(wheeled - wheelStart).toBeGreaterThan(0);
  expect(wheeled - wheelStart).toBeLessThan(.03);
  await page.mouse.wheel(-12, 0);
  await expect.poll(async () => Math.abs(Number(await host(page).getAttribute('data-progress')) - wheelStart)).toBeLessThan(.001);
  expect(errors).toEqual([]);
});

test('extragalactic host, Milky Way, polarization and Earth retain the physical event and visible equations', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  let previousCamera = -Infinity;
  for (const id of ['anfitriona', 'galaxia', 'polarizacion', 'tierra']) {
    await stage(page, id);
    await expect(host(page)).toHaveAttribute('data-event-id', 'LF-241032');
    await expect(page.locator('.math-panel')).toHaveAttribute('data-stage', id);
    await expect(page.locator('.math-equation .katex')).toBeVisible();
    await expect(page.locator('.term-unit')).not.toBeEmpty();
    const camera = Number((await host(page).getAttribute('data-camera'))!.split(',')[0]);
    expect(camera).toBeGreaterThan(previousCamera); previousCamera = camera;
    expect(await coloredPixels(page), `${id} must render a nonblank physical scene`).toBeGreaterThan(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const terms = page.locator('.math-terms button');
    await terms.first().click();
    await expect(host(page)).toHaveAttribute('data-focus', (await page.locator('.math-panel').getAttribute('data-term'))!);
    await page.screenshot({ path: `validation/screenshots/global-${info.project.name}-${id}.png` });
  }
  await expect(page.locator('.caption')).toContainText('Puerto Rico');
  await stage(page, 'plasma', .64);
  await expect(host(page)).toHaveAttribute('data-dm-current', '380');
  await stage(page, 'galaxia', .01);
  await expect(host(page)).toHaveAttribute('data-dm-current', '380');
  await stage(page, 'galaxia', .64);
  await expect(host(page)).toHaveAttribute('data-dm-current', '500');
  await stage(page, 'tierra', .64);
  await expect(host(page)).toHaveAttribute('data-received-count', '6');
  await expect(host(page)).toHaveAttribute('data-asset-ready', 'true');
  expect(errors).toEqual([]);
});

test('all detection and classification combinations build unique unambiguous routes', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page);
  await page.getByRole('button', { name: 'Ir a Métodos', exact: true }).click();
  await expect(host(page)).toHaveAttribute('data-stage-id', 'metodos');
  await expect(detector(page)).toHaveValue('cnn');
  await expect(classifier(page)).toHaveValue('resnet');
  await page.screenshot({ path: `validation/screenshots/global-${info.project.name}-methods.png` });
  const detections = {
    boxcar: ['boxcar', 'boxcar-bank', 'boxcar-threshold'],
    cnn: ['rgb', 'backbone', 'upsampling', 'cabezas', 'centernet'],
    transformer: ['vit-patches', 'vit-detection', 'vit-proposals'],
  };
  const classifications = {
    radio: ['radio-checks'], forest: ['forest-features', 'forest'],
    resnet: ['recorte', 'resnet', 'decision'], transformer: ['vit-classification'],
  };
  for (const detection of Object.keys(detections) as (keyof typeof detections)[]) {
    for (const classification of Object.keys(classifications) as (keyof typeof classifications)[]) {
      await detector(page).selectOption(detection);
      await classifier(page).selectOption(classification);
      await expect(detector(page)).toHaveValue(detection);
      await expect(classifier(page)).toHaveValue(classification);
      const ids = await routeIds(page);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.filter(id => id === 'metodos')).toHaveLength(1);
      const classificationIds = classification === 'resnet' && detection !== 'cnn' ? ['resnet-didactic'] : classifications[classification];
      for (const id of ['anfitriona', 'galaxia', 'polarizacion', 'tierra', ...detections[detection], ...classificationIds]) expect(ids).toContain(id);
      for (const [other, stages] of Object.entries(detections)) if (other !== detection) for (const id of stages) expect(ids).not.toContain(id);
      const recorded = detection === 'cnn' && classification === 'resnet';
      expect(ids.at(-1)).toBe(recorded ? 'candidato' : 'candidate-didactic');
      expect(ids).not.toContain(recorded ? 'candidate-didactic' : 'candidato');
      await expect(host(page)).toHaveAttribute('data-stage-id', 'metodos');
    }
  }
  expect(errors).toEqual([]);
});

test('changing methods at the recorded candidate invalidates its score and returns to the method junction', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page, '&detector=cnn&classifier=resnet');
  await stage(page, 'candidato', .64);
  await expect(host(page)).toHaveAttribute('data-evidence', 'verified');
  await expect(page.locator('.finale-panel')).toHaveAttribute('data-mode', 'recorded');
  await expect(page.locator('.finale-panel')).toContainText('67,82');
  await stage(page, 'metodos', .6);
  await detector(page).selectOption('boxcar');
  await expect(host(page)).toHaveAttribute('data-stage-id', 'metodos');
  await expect(page.locator('.finale-panel')).toHaveCount(0);
  await classifier(page).selectOption('radio');
  await stage(page, 'candidate-didactic', .64);
  await expect(page.locator('.finale-panel')).toHaveAttribute('data-mode', 'didactic');
  await expect(page.locator('.finale-panel')).toContainText(/sin inferencia entrenada/i);
  await expect(page.locator('.finale-panel')).not.toContainText('67,82');
  await expect(page.locator('.finale-panel')).not.toContainText('Centro CNN');
  await stage(page, 'metodos', .6);
  await classifier(page).selectOption('forest');
  await expect(host(page)).toHaveAttribute('data-stage-id', 'metodos');
  await stage(page, 'forest');
  await expect(page.locator('.math-panel')).toContainText(/votos|árboles|arboles/i);
  await page.screenshot({ path: `validation/screenshots/global-${info.project.name}-forest.png` });
  await stage(page, 'candidate-didactic', .64);
  await expect(page.locator('.finale-panel')).toHaveAttribute('data-mode', 'didactic');
  await expect(page.locator('.finale-panel')).toContainText(/sin inferencia entrenada/i);
  expect(errors).toEqual([]);
});

test('visual transformers illustrate patches, attention and classification without stale trained scores', async ({ page }, info) => {
  const errors = watchErrors(page);
  await open(page, '&detector=transformer&classifier=transformer');
  for (const id of ['vit-patches', 'vit-detection', 'vit-proposals', 'vit-classification']) {
    await stage(page, id);
    await expect(page.locator('.math-panel')).toHaveAttribute('data-stage', id);
    await expect(page.locator('.math-equation .katex')).toBeVisible();
    await page.locator('.math-terms button').first().click();
    await expect(host(page)).toHaveAttribute('data-focus', (await page.locator('.math-panel').getAttribute('data-term'))!);
    expect(await coloredPixels(page), `${id} must render its illustrative operation`).toBeGreaterThan(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `validation/screenshots/global-${info.project.name}-${id}.png` });
  }
  await stage(page, 'candidate-didactic', .64);
  await expect(page.locator('.finale-panel')).toHaveAttribute('data-mode', 'didactic');
  await expect(page.locator('.finale-panel')).toContainText(/sin inferencia entrenada/i);
  await expect(page.locator('.finale-panel')).not.toContainText('67,82');
  await expect(page.locator('.finale-panel')).not.toContainText('Centro CNN');
  await page.screenshot({ path: `validation/screenshots/global-${info.project.name}-didactic-candidate.png` });
  expect(errors).toEqual([]);
});
