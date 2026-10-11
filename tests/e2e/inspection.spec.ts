import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const host = (page: Page) => page.locator('.cinema-canvas');
async function at(page: Page, id: string, local = .64) {
  const ids = await page.locator('.story-step').evaluateAll(steps => steps.map(step => step.id));
  expect(ids).toContain(id);
  const value = ids.indexOf(id) + local;
  await page.getByRole('slider', { name: 'Posición en el recorrido', exact: true }).evaluate((element, requested) => {
    (element as HTMLInputElement).value = String(requested);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await expect(host(page)).toHaveAttribute('data-stage-id', id);
  await expect.poll(async () => Math.abs(Number(await host(page).getAttribute('data-progress')) - value)).toBeLessThan(.002);
}
async function open(page: Page, observation = 'arecibo-lf') {
  await page.goto(`/?qa=1&still=1&observation=${observation}`);
  await expect(host(page)).toHaveAttribute('data-ready', 'true');
  await mkdir('validation/screenshots', { recursive: true });
}
async function plotPixels(page: Page) {
  const hidden = await page.addStyleTag({ content: '.site-header,.plot-toolbar,.event-flow,.act-navigation,.journey-footer,.scene-shade,.explanation-stack,.scientific-readout,.finale-panel { visibility:hidden!important; }' });
  try {
    await expect.poll(async () => {
      const shot = await host(page).locator('canvas').screenshot({ path: `validation/screenshots/inspection-pixels-${await host(page).getAttribute('data-inspection-view')}-${page.viewportSize()!.width}.png` });
      return page.evaluate(async bytes => {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d')!;
        context.drawImage(bitmap, 0, 0); bitmap.close();
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let central = 0;
        for (let i = 0; i < pixels.length; i += 32) {
          const high = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
          const x = (i / 4) % canvas.width, y = Math.floor(i / 4 / canvas.width);
          if (high > 70 && x > canvas.width * .2 && x < canvas.width * .8 && y > canvas.height * .25 && y < canvas.height * .75) central++;
        }
        return central;
      }, Array.from(shot));
    }).toBeGreaterThan(200);
  } finally {
    await hidden.evaluate(element => element.parentNode?.removeChild(element));
    // Unhiding HTML can invalidate a headless on-demand WebGL capture; request the same pose again.
    const names: Record<string, string> = { front: 'Vista frontal', side: 'Vista lateral', top: 'Vista superior', perspective: 'Vista perspectiva' };
    const view = await host(page).getAttribute('data-inspection-view');
    if (view && names[view]) await page.getByRole('button', { name: names[view], exact: true }).click();
  }
}
async function range(page: Page, value: number) {
  const slider = page.getByRole('slider', { name: 'Relieve de amplitud', exact: true });
  await slider.focus(); await slider.press('Home');
  for (let step = 0; step < Math.round(value / .05); step++) await slider.press('ArrowRight');
}

test('CNN and ResNet default to a centered finale with a brief confirmation note', async ({ page }, info) => {
  await open(page);
  await expect(page.locator('.story-step')).toHaveCount(27);
  await at(page, 'metodos');
  await expect(page.getByRole('combobox', { name: 'Método de detección', exact: true })).toHaveValue('cnn');
  await expect(page.getByRole('combobox', { name: 'Método de clasificación', exact: true })).toHaveValue('resnet');
  await at(page, 'candidato');
  const panel = page.locator('.finale-panel');
  await expect(panel).toHaveAttribute('data-mode', 'recorded');
  await expect(panel.locator('h2')).toHaveText('Candidato detectado.');
  await expect(panel.locator('.finale-confirmation')).toBeVisible();
  await expect(panel).toContainText('Para confirmar: descartar RFI y contrastar evidencia astronómica independiente.');
  await expect(panel.locator('canvas')).toHaveCount(3);
  await expect(page.locator('.explanation-stack')).toHaveCount(0);
  const bounds = await panel.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const flow = document.querySelector('.event-flow')!.getBoundingClientRect();
    return { center: (rect.left + rect.right) / 2, viewport: innerWidth, flowLeft: flow.left, flowRight: flow.right,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  expect(bounds.center).toBeCloseTo(bounds.viewport / 2, 0);
  expect(bounds.flowLeft).toBeGreaterThanOrEqual(0);
  expect(bounds.flowRight).toBeLessThanOrEqual(bounds.viewport);
  expect(bounds.overflow).toBe(false);
  await page.screenshot({ path: `validation/screenshots/inspection-${info.project.name}-finale-centered.png` });
  await page.getByRole('button', { name: 'Ruta del candidato', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Origen del candidato', exact: true })).toBeVisible();
});

test('LF plot orbit, pan, zoom and amplitude relief preserve science and story progress', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page);
  await at(page, 'matriz');
  await expect(host(page)).toHaveAttribute('data-evidence', 'verified');
  const before = await host(page).evaluate(element => ({ progress: element.dataset.progress, completed: element.dataset.completed,
    total: element.dataset.total, event: element.dataset.eventId, scroll: scrollY }));
  await page.getByRole('button', { name: 'Explorar gráfico en 3D', exact: true }).click();
  await expect(host(page)).toHaveAttribute('data-inspection', 'true');
  await expect(page.locator('.explanation-stack')).toHaveCount(0);
  const canvas = host(page).locator('canvas'), box = (await canvas.boundingBox())!;
  const x = box.x + box.width * .5, y = box.y + box.height * .52;
  const camera = await host(page).getAttribute('data-camera');
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 70, y + 35, { steps: 8 }); await page.mouse.up();
  await expect.poll(() => host(page).getAttribute('data-camera')).not.toBe(camera);
  const target = await host(page).getAttribute('data-camera-target');
  await page.mouse.move(x, y); await page.mouse.down({ button: 'right' });
  await page.mouse.move(x + 30, y - 25, { steps: 6 }); await page.mouse.up({ button: 'right' });
  await expect.poll(() => host(page).getAttribute('data-camera-target')).not.toBe(target);
  const distance = Number(await host(page).getAttribute('data-camera-distance'));
  await page.mouse.move(x, y); await page.mouse.wheel(0, -240);
  await expect.poll(async () => Number(await host(page).getAttribute('data-camera-distance'))).toBeLessThan(distance);
  for (const [name, view] of [['Vista frontal', 'front'], ['Vista lateral', 'side'], ['Vista superior', 'top'], ['Vista perspectiva', 'perspective']]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(host(page)).toHaveAttribute('data-inspection-view', view);
    await plotPixels(page);
  }
  await range(page, 2);
  await expect(host(page)).toHaveAttribute('data-inspection-relief', '2');
  const after = await host(page).evaluate(element => ({ progress: element.dataset.progress, completed: element.dataset.completed,
    total: element.dataset.total, event: element.dataset.eventId, scroll: scrollY }));
  expect(after).toEqual(before);
  await canvas.focus();
  const keyTarget = await host(page).getAttribute('data-camera-target');
  await canvas.press('ArrowRight');
  await expect.poll(() => host(page).getAttribute('data-camera-target')).not.toBe(keyTarget);
  if (info.project.name === 'mobile') {
    const session = await page.context().newCDPSession(page);
    const touchCamera = await host(page).getAttribute('data-camera');
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 45, y: y + 25, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => host(page).getAttribute('data-camera')).not.toBe(touchCamera);
    await session.detach();
  }
  await page.getByRole('button', { name: 'Restaurar vista', exact: true }).click();
  await page.screenshot({ path: `validation/screenshots/inspection-${info.project.name}-lf-relief.png` });
  await page.getByRole('button', { name: 'Volver al recorrido', exact: true }).click();
  await expect(host(page)).toHaveAttribute('data-inspection', 'false');
  await expect(page.locator('.math-panel')).toBeVisible();
  await expect(page.locator('.math-panel')).toHaveAttribute('data-term', 'power');
  await at(page, 'bowtie');
  await expect(host(page)).toHaveAttribute('data-inspection', 'false');
  await page.getByRole('button', { name: 'Explorar gráfico en 3D', exact: true }).click();
  await page.getByRole('button', { name: 'Vista superior', exact: true }).click();
  await plotPixels(page);
  await host(page).locator('canvas').focus();
  await page.keyboard.press('Escape');
  await expect(host(page)).toHaveAttribute('data-inspection', 'false');
  await expect(page.locator('.math-panel')).toHaveAttribute('data-term', 'mean');
  await expect(page.getByRole('button', { name: 'Explorar gráfico en 3D', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('HF amplitude inspection has independent data and cleans up after case changes', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, 'alma-hf');
  await at(page, 'hf-matriz');
  await page.getByRole('button', { name: 'Explorar gráfico en 3D', exact: true }).click();
  await expect(host(page)).toHaveAttribute('data-inspection', 'true');
  await range(page, 2.5);
  await expect(host(page)).toHaveAttribute('data-inspection-relief', '2.5');
  await page.getByRole('button', { name: 'Vista lateral', exact: true }).click();
  await plotPixels(page);
  await page.screenshot({ path: `validation/screenshots/inspection-${info.project.name}-hf-relief.png` });
  await page.getByRole('combobox', { name: 'Caso de observación', exact: true }).selectOption('arecibo-lf');
  await expect(host(page)).toHaveAttribute('data-inspection', 'false');
  await expect(host(page)).toHaveAttribute('data-observation', 'arecibo-lf');
  await expect(host(page).locator('canvas')).toHaveCount(1);
  await expect(page.locator('.plot-toolbar')).toHaveCount(0);
  await at(page, 'candidato');
  await expect(page.locator('.finale-panel')).toHaveAttribute('data-mode', 'recorded');
  expect(errors).toEqual([]);
});

test('compact final views keep the confirmation note and plots reachable', async ({ page }, info) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const observation of ['arecibo-lf', 'alma-hf']) {
      await open(page, observation); await at(page, observation === 'alma-hf' ? 'hf-candidato' : 'candidato');
      const panel = page.locator('.finale-panel'), note = panel.locator('.finale-confirmation');
      await expect(note).toBeVisible();
      const dimensions = await page.evaluate(() => {
        const panel = document.querySelector('.finale-panel')!.getBoundingClientRect();
        const header = document.querySelector('.site-header')!.getBoundingClientRect();
        const note = document.querySelector('.finale-confirmation')!.getBoundingClientRect();
        const flow = document.querySelector('.event-flow')!.getBoundingClientRect();
        return { panelTop: panel.top, headerBottom: header.bottom, noteTop: note.top, noteBottom: note.bottom,
          panelBottom: panel.bottom, flowTop: flow.top, flowLeft: flow.left, flowRight: flow.right,
          charts: Array.from(document.querySelectorAll('.finale-chart canvas'), el => el.getBoundingClientRect().height),
          center: (panel.left + panel.right) / 2, viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      expect(dimensions.panelTop).toBeGreaterThanOrEqual(dimensions.headerBottom);
      expect(dimensions.noteTop).toBeGreaterThanOrEqual(dimensions.panelTop);
      expect(dimensions.noteBottom).toBeLessThanOrEqual(dimensions.panelBottom + 1);
      expect(dimensions.panelBottom).toBeLessThanOrEqual(dimensions.flowTop);
      expect(dimensions.flowLeft).toBeGreaterThanOrEqual(0);
      expect(dimensions.flowRight).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.center).toBeCloseTo(dimensions.viewport / 2, 0);
      expect(dimensions.charts.every(height => height >= 34)).toBe(true);
      expect(dimensions.overflow).toBe(false);
      await page.screenshot({ path: `validation/screenshots/inspection-${info.project.name}-${observation}-finale-${viewport.width}.png` });
    }
  }
});
