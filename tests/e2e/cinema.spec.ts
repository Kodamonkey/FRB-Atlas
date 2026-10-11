import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { actStartsFor, storyFor } from '../../src/routes';

const STORY = storyFor({ detection: 'cnn', classification: 'resnet' });
const ACT_STARTS = actStartsFor(STORY);
const RECORDED_URL = '/?qa=1&detector=cnn&classifier=resnet';

const indexOf = (id: string) => STORY.findIndex(step => step.id === id);
const FINAL = STORY.length - 1;

async function coloredScene(page: Page) {
  const hidden = await page.addStyleTag({ content: '.scene-shade,.site-header,.explanation-stack,.story-copy,.scientific-readout,.act-navigation,.journey-footer,.event-flow,.next-hint,.finale-panel{visibility:hidden!important}' });
  const screenshot = await page.locator('.cinema-canvas canvas').screenshot();
  await hidden.evaluate(element => element.parentNode?.removeChild(element));
  return page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const scratch = document.createElement('canvas'); scratch.width = image.width; scratch.height = image.height;
    const context = scratch.getContext('2d')!; context.drawImage(image, 0, 0, scratch.width, scratch.height);
    const data = context.getImageData(0, 0, scratch.width, scratch.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.max(r,g,b) > 45 && Math.max(r,g,b) - Math.min(r,g,b) > 18) count++;
    }
    return count;
  }, screenshot.toString('base64'));
}

async function sequence(page: Page, index: number, local = .64) {
  await page.evaluate(({ index, local }) => {
    const steps = Array.from(document.querySelectorAll<HTMLElement>('.story-step'));
    const start = steps[index].offsetTop;
    const end = steps[index + 1]?.offsetTop ?? document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: start + (end - start) * local, behavior: 'instant' });
  }, { index, local });
  if (STORY[index].id === 'candidato') {
    await expect(page.locator('.cinema-canvas')).toHaveAttribute('data-stage-id', 'candidato');
    await expect(page.locator('.finale-panel')).toBeVisible();
  } else {
    await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', String(index));
  }
  await page.waitForFunction(({ index }) => {
    const state = (window as unknown as { __CINEMA__: { sequence: number; local: number } }).__CINEMA__;
    const steps = Array.from(document.querySelectorAll<HTMLElement>('.story-step'));
    const end = steps[index + 1]?.offsetTop ?? document.documentElement.scrollHeight - innerHeight;
    const actual = (scrollY - steps[index].offsetTop) / (end - steps[index].offsetTop);
    return state?.sequence === index && Math.abs(state.local - actual) < .0001;
  }, { index, local });
  await page.waitForTimeout(250);
}

test('recorded CNN route, continuous canvas, reversible camera and exact evidence', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${RECORDED_URL}&still=1`);
  await expect(page.locator('h1')).toHaveText('FRB Atlas');
  await page.locator('.cinema-canvas[data-ready="true"] canvas').waitFor();
  await page.evaluate(() => { (document.querySelector('.cinema-canvas canvas') as HTMLElement).dataset.identity = 'persistent'; });
  await mkdir('validation/screenshots', { recursive: true });
  await expect(page.locator('.story-step')).toHaveCount(STORY.length);
  let previousX = -Infinity;
  for (let index = 0; index < STORY.length; index++) {
    await sequence(page, index);
    if (STORY[index].requiresEvidence) await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.locator('.cinema-canvas canvas')).toHaveAttribute('data-identity', 'persistent');
    await expect(page.locator('.event-flow')).toContainText('LF–241032');
    await expect(page.locator('.flow-output')).toHaveText(STORY[index].output);
    const cameraX = Number((await page.locator('.cinema-canvas').getAttribute('data-camera'))!.split(',')[0]);
    expect(cameraX).toBeGreaterThan(previousX); previousX = cameraX;
    expect(await coloredScene(page), `${STORY[index].id} must contain rendered scientific or illustrative assets`).toBeGreaterThan(25);
    if (['faro', 'plasma', 'antenas', 'fase', 'fft', 'matriz', 'perfil', 'centernet', 'recorte', 'resnet', 'candidato'].includes(STORY[index].id)) await page.screenshot({ path: `validation/screenshots/${info.project.name}-${index}.png` });
  }
  await expect(page.locator('.finale-panel')).toHaveAttribute('data-mode', 'recorded');
  await expect(page.locator('.finale-panel')).toContainText('494,74');
  await expect(page.locator('.finale-panel')).toContainText('67,82');
  await sequence(page, indexOf('plasma'), .45);
  const forwardCamera = await page.locator('.cinema-canvas').getAttribute('data-camera');
  await sequence(page, indexOf('resnet'));
  await sequence(page, indexOf('plasma'), .45);
  expect(await page.locator('.cinema-canvas').getAttribute('data-camera')).toBe(forwardCamera);
  expect(errors).toEqual([]);
});

test('native scroll, pause, quality, focus and sources', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(RECORDED_URL);
  await page.locator('.cinema-canvas[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: 'Pausar movimiento', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reanudar movimiento', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ir a Captura', exact: true }).click();
  await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', String(ACT_STARTS[2]));
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Calidad visual', exact: true }).click();
  await page.getByRole('button', { name: 'Alta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Alta', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ver evidencia y fuentes', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.evidence-facts')).toContainText('67,821686');
  await expect(page.locator('.evidence-dialog')).toContainText('no observación confirmada');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver evidencia y fuentes', exact: true })).toBeFocused();
  await sequence(page, indexOf('bowtie'));
  await page.getByRole('button', { name: 'Reanudar movimiento', exact: true }).click();
  const host = page.locator('.cinema-canvas');
  await expect(host).toHaveAttribute('data-render-mode', 'on-demand');
  await page.waitForTimeout(700);
  const frames = Number(await host.getAttribute('data-frames'));
  await page.waitForTimeout(700);
  expect(Number(await host.getAttribute('data-frames'))).toBe(frames);
  await sequence(page, indexOf('centernet'));
  expect(Number(await host.getAttribute('data-frames'))).toBeGreaterThan(frames);
  await page.getByRole('button', { name: 'Volver al pulso', exact: true }).click();
  await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', '0', { timeout: 8000 });
  await page.getByRole('link', { name: 'FRB Atlas, volver al inicio' }).focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe('solid');
  expect(errors).toEqual([]);
});

test('reduced motion and context-loss retain the full story', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(RECORDED_URL);
  await page.locator('.cinema-canvas[data-ready="true"] canvas').waitFor();
  await expect(page.locator('.cinema-canvas')).toHaveAttribute('data-render-mode', 'on-demand');
  await expect(page.getByRole('button', { name: 'Reanudar movimiento', exact: true })).toBeDisabled();
  for (const index of [indexOf('plasma'), indexOf('bloques'), FINAL]) {
    await sequence(page, index);
    await expect(page.locator('.cinema-canvas')).toHaveAttribute('data-handoff', '0.0000');
  }
  await sequence(page, indexOf('matriz'), .15);
  await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
  await expect(page.locator('.cinema-canvas')).toHaveAttribute('data-operation', '1.0000');
  await expect(page.locator('.math-panel')).toHaveAttribute('data-term', 'power');
  await expect(page.locator('.event-flow')).toHaveAttribute('data-phase', 'output');
  expect(await page.locator('.cinema-canvas').getAttribute('data-completed')).toBe(await page.locator('.cinema-canvas').getAttribute('data-total'));
  await sequence(page, indexOf('plasma'));
  await page.locator('.math-terms button').first().click();
  await expect(page.locator('.cinema-canvas')).toHaveAttribute('data-focus', 'density');
  const staticFrame = await page.locator('.cinema-canvas canvas').screenshot();
  await page.waitForTimeout(650);
  expect((await page.locator('.cinema-canvas canvas').screenshot()).equals(staticFrame)).toBe(true);
  await page.locator('.math-terms button').last().click();
  await expect(page.locator('.cinema-canvas')).toHaveAttribute('data-focus', 'delay');
  expect((await page.locator('.cinema-canvas canvas').screenshot()).equals(staticFrame)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.cinema-canvas[data-ready="true"] canvas').waitFor();
  await page.evaluate(() => document.querySelector('.cinema-canvas canvas')!.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(page.locator('.poster-surface')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reanudar movimiento', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Calidad visual', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ir a Viaje', exact: true }).click();
  await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', String(ACT_STARTS[1]));
});

test('corrupt scientific asset never displays a score and can retry', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/evidence/prepared-crop.f32', route => route.fulfill({ status: 200, body: Buffer.alloc(131072), contentType: 'application/octet-stream' }));
  await page.goto(`${RECORDED_URL}&still=1`);
  await sequence(page, FINAL);
  await page.locator('.cinema-canvas[data-evidence="error"]').waitFor();
  await expect(page.locator('.finale-error')).toContainText('Evidencia no disponible');
  await expect(page.locator('.finale-panel')).not.toHaveAttribute('data-mode', 'recorded');
  await expect(page.locator('.finale-panel canvas')).toHaveCount(0);
  await expect(page.locator('.finale-panel')).not.toContainText('67,82');
  await page.unroute('**/evidence/prepared-crop.f32');
  await page.getByRole('button', { name: 'Reintentar evidencia', exact: true }).click();
  await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
  await expect(page.locator('.finale-panel')).toHaveAttribute('data-mode', 'recorded');
  await expect(page.locator('.finale-panel')).toContainText('67,82');
  expect(errors).toEqual([]);
});

test('restored scroll reloads evidence without an aborted-load deadlock', async ({ page }) => {
  await page.goto(`${RECORDED_URL}&still=1`);
  await sequence(page, indexOf('centernet'));
  await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
  await page.reload();
  await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', String(indexOf('centernet')));
  await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
  await sequence(page, FINAL);
  await expect(page.locator('.finale-panel')).toHaveAttribute('data-mode', 'recorded');
  await expect(page.locator('.finale-panel')).toContainText('67,82');
});

test('compact viewport keeps captions clear of readout and navigation', async ({ page }, info) => {
  await page.setViewportSize(info.project.name === 'mobile' ? { width: 320, height: 568 } : { width: 1366, height: 768 });
  await page.goto(`${RECORDED_URL}&still=1`);
  await page.locator('.cinema-canvas[data-ready="true"] canvas').waitFor();
  for (let index = 0; index < STORY.length; index++) {
    await sequence(page, index);
    if (STORY[index].requiresEvidence) await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
    const bounds = await page.evaluate(() => {
      const copy = document.querySelector('.story-copy')?.getBoundingClientRect();
      const readout = document.querySelector('.scientific-readout')?.getBoundingClientRect();
      const navigation = document.querySelector('.act-navigation')!.getBoundingClientRect();
      const flow = document.querySelector('.event-flow')!.getBoundingClientRect();
      const identity = document.querySelector('.event-identity')!.getBoundingClientRect();
      const math = document.querySelector('.math-panel')?.getBoundingClientRect();
      const equation = document.querySelector('.math-equation')?.getBoundingClientRect();
      const content = document.querySelector('.math-equation .katex')?.getBoundingClientRect();
      const finale = document.querySelector('.finale-panel')?.getBoundingClientRect();
      const header = document.querySelector('.site-header')!.getBoundingClientRect();
      return { isFinal: Boolean(finale), copyBottom: copy?.bottom ?? 0, readoutTop: readout?.height ? readout.top : innerHeight,
        navigationTop: innerWidth < 760 ? navigation.top : innerHeight, flowTop: Math.min(flow.top, identity.top), height: innerHeight,
        mathBottom: math?.bottom ?? copy?.bottom ?? 0, mathTop: math?.top ?? copy?.bottom ?? 0,
        equationWidth: equation?.width ?? 0, contentWidth: content?.width ?? 0, finaleBottom: finale?.bottom ?? 0,
        finaleTop: finale?.top ?? 0, headerBottom: header.bottom, hasCopy: Boolean(copy), hasReadout: Boolean(readout),
        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    if (bounds.isFinal) {
      expect(bounds.hasCopy).toBe(false);
      expect(bounds.hasReadout).toBe(false);
      expect(bounds.finaleTop).toBeGreaterThanOrEqual(bounds.headerBottom);
    } else {
      expect(bounds.hasCopy).toBe(true);
      expect(bounds.copyBottom).toBeLessThan(bounds.readoutTop);
      expect(bounds.copyBottom).toBeLessThan(bounds.navigationTop);
      expect(bounds.copyBottom).toBeLessThan(bounds.flowTop);
      expect(bounds.mathTop).toBeGreaterThanOrEqual(bounds.copyBottom - 1);
      expect(bounds.mathBottom).toBeLessThan(bounds.flowTop);
    }
    expect(bounds.finaleBottom).toBeLessThan(bounds.flowTop);
    expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.equationWidth + 1);
    expect(bounds.overflow).toBe(false);
    await page.screenshot({ path: `validation/screenshots/compact-${info.project.name}-${index}.png` });
  }
});

test('tablet and landscape keep captions above the event flow', async ({ page }, info) => {
  for (const viewport of [{ width: 720, height: 1000 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${RECORDED_URL}&still=1`);
    await page.locator('.cinema-canvas[data-ready="true"] canvas').waitFor();
    for (const index of [0, indexOf('fft'), indexOf('perfil'), indexOf('resnet'), FINAL]) {
      await sequence(page, index);
      if (STORY[index].requiresEvidence) await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
      const bounds = await page.evaluate(() => {
        const copy = document.querySelector('.story-copy')?.getBoundingClientRect();
        const flow = document.querySelector('.event-flow')!.getBoundingClientRect();
        const readout = document.querySelector('.scientific-readout')?.getBoundingClientRect();
        const math = document.querySelector('.math-panel')?.getBoundingClientRect();
        const finale = document.querySelector('.finale-panel')?.getBoundingClientRect();
        const header = document.querySelector('.site-header')!.getBoundingClientRect();
        return { isFinal: Boolean(finale), copyBottom: copy?.bottom ?? 0, flowTop: flow.top, readoutTop: readout?.height ? readout.top : innerHeight,
          mathBottom: math?.bottom ?? copy?.bottom ?? 0, finaleBottom: finale?.bottom ?? 0,
          finaleTop: finale?.top ?? 0, headerBottom: header.bottom, hasCopy: Boolean(copy), hasReadout: Boolean(readout),
          overflow: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      if (bounds.isFinal) {
        expect(bounds.hasCopy).toBe(false);
        expect(bounds.hasReadout).toBe(false);
        expect(bounds.finaleTop).toBeGreaterThanOrEqual(bounds.headerBottom);
      } else {
        expect(bounds.hasCopy).toBe(true);
        expect(bounds.copyBottom).toBeLessThan(bounds.flowTop);
        expect(bounds.copyBottom).toBeLessThan(bounds.readoutTop);
        expect(bounds.mathBottom).toBeLessThan(bounds.flowTop);
      }
      expect(bounds.finaleBottom).toBeLessThan(bounds.flowTop);
      expect(bounds.overflow).toBe(false);
      await page.screenshot({ path: `validation/screenshots/responsive-${info.project.name}-${viewport.width}-${index}.png` });
    }
  }
});

test('equation terms focus physical objects, remain keyboard accessible and reset per phase', async ({ page }, info) => {
  await page.goto(`${RECORDED_URL}&still=1`);
  const host = page.locator('.cinema-canvas');
  await host.locator('canvas').waitFor();
  await sequence(page, indexOf('plasma'));
  const panel = page.locator('.math-panel');
  await expect(panel).toContainText('pc cm');
  const density = panel.locator('.math-terms button').first();
  await density.focus(); await page.keyboard.press('Enter');
  await expect(panel).toHaveAttribute('data-term', 'density');
  await expect(host).toHaveAttribute('data-focus', 'density');
  await expect(density).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.locator('.term-density')).toHaveClass(/is-active/);
  const first = await host.locator('canvas').screenshot();
  await panel.locator('.math-terms button').nth(2).click();
  await expect(host).toHaveAttribute('data-focus', 'dm');
  await expect(panel.locator('.term-dm')).toHaveClass(/is-active/);
  await page.screenshot({ path: `validation/screenshots/math-${info.project.name}-dm.png` });
  await panel.locator('.math-terms button').last().click();
  await expect(host).toHaveAttribute('data-focus', 'delay');
  await page.waitForTimeout(120);
  expect((await host.locator('canvas').screenshot()).equals(first)).toBe(false);
  await page.screenshot({ path: `validation/screenshots/math-${info.project.name}-plasma.png` });
  await page.getByRole('combobox', { name: 'Caso de observación' }).selectOption('alma-hf');
  await expect(host).toHaveAttribute('data-observation', 'alma-hf');
  await sequence(page, storyFor({ detection: 'cnn', classification: 'resnet' }, 'alma-hf').findIndex(step => step.id === 'fase'));
  await expect(panel).toHaveAttribute('data-mode', 'automatic');
  await panel.locator('.math-terms button').nth(1).click();
  await expect(host).toHaveAttribute('data-focus', 'product');
  await expect(panel).toContainText(/Correlador/);
  await page.screenshot({ path: `validation/screenshots/math-${info.project.name}-correlator.png` });
  await page.getByRole('button', { name: 'Seguir términos automáticamente' }).click();
  await expect(panel).toHaveAttribute('data-mode', 'automatic');
});

test('native plot writes discrete data, reverses and replays without new inference', async ({ page }, info) => {
  await page.goto(`${RECORDED_URL}&still=1`);
  const host = page.locator('.cinema-canvas');
  await host.locator('canvas').waitFor();
  for (const id of ['matriz', 'perfil', 'bowtie']) {
    const index = indexOf(id);
    await sequence(page, index, .20);
    await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
    await page.waitForFunction(id => {
      const host = document.querySelector<HTMLElement>('.cinema-canvas')!;
      const state = (window as unknown as { __CINEMA__: { local: number } }).__CINEMA__;
      const x = Math.max(0, Math.min(1, (state.local - .08) / .48));
      return host.dataset.stageId === id && Number(host.dataset.total) > 0
        && Math.abs(Number(host.dataset.operation) - x * x * (3 - 2 * x)) < .0002;
    }, id);
    const early = Number(await host.getAttribute('data-completed'));
    const total = Number(await host.getAttribute('data-total'));
    expect(early).toBeGreaterThan(0); expect(early).toBeLessThan(total);
    expect(Number.isInteger(early)).toBe(true);
    await sequence(page, index, .39);
    const middle = Number(await host.getAttribute('data-completed'));
    expect(middle).toBeGreaterThan(early); expect(middle).toBeLessThan(total);
    await page.screenshot({ path: `validation/screenshots/plot-${info.project.name}-${id}.png` });
    await sequence(page, index, .20);
    expect(Number(await host.getAttribute('data-completed'))).toBe(early);
    await sequence(page, index, .64);
    expect(Number(await host.getAttribute('data-completed'))).toBe(total);
  }
  await page.getByRole('button', { name: 'Repetir operación', exact: true }).click();
  await expect.poll(async () => Number(await host.getAttribute('data-completed'))).toBeLessThan(Number(await host.getAttribute('data-total')));
  await page.waitForTimeout(1500);
  const during = Number(await host.getAttribute('data-completed'));
  await page.waitForTimeout(1500);
  expect(Number(await host.getAttribute('data-completed'))).toBeGreaterThan(during);
  await expect.poll(async () => Number(await host.getAttribute('data-completed'))).toBe(Number(await host.getAttribute('data-total')));
});

test('WebGL contains colored pixels; pause is stable and resume changes the scene', async ({ page }) => {
  await page.goto(`${RECORDED_URL}&still=1`);
  await page.locator('.cinema-canvas[data-ready="true"] canvas').waitFor();
  await page.waitForTimeout(600);
  const hide = await page.addStyleTag({ content: '.scene-shade,.site-header,.explanation-stack,.story-copy,.scientific-readout,.act-navigation,.journey-footer,.event-flow,.next-hint{visibility:hidden!important}' });
  const canvas = page.locator('.cinema-canvas canvas');
  const first = await canvas.screenshot();
  const pixels = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const scratch = document.createElement('canvas'); scratch.width = image.width; scratch.height = image.height;
    const context = scratch.getContext('2d')!; context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    let bright = 0, colored = 0; const bins = new Set<number>();
    for (let index = 0; index < data.length; index += 16) {
      const r = data[index], g = data[index + 1], b = data[index + 2];
      if (Math.max(r, g, b) > 35) bright++;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 20) colored++;
      bins.add((r >> 4) * 256 + (g >> 4) * 16 + (b >> 4));
    }
    return { bright, colored, bins: bins.size };
  }, first.toString('base64'));
  expect(pixels.bright).toBeGreaterThan(500);
  expect(pixels.colored).toBeGreaterThan(100);
  expect(pixels.bins).toBeGreaterThan(20);
  await page.waitForTimeout(650);
  expect((await canvas.screenshot()).equals(first)).toBe(true);
  await hide.evaluate(element => element.parentNode?.removeChild(element));
  await page.getByRole('button', { name: 'Reanudar movimiento', exact: true }).click();
  const hideAgain = await page.addStyleTag({ content: '.scene-shade,.site-header,.explanation-stack,.story-copy,.scientific-readout,.act-navigation,.journey-footer,.event-flow,.next-hint{visibility:hidden!important}' });
  await page.waitForTimeout(1200);
  expect((await canvas.screenshot()).equals(first)).toBe(false);
  await hideAgain.evaluate(element => element.parentNode?.removeChild(element));
});

test('output hold, rightward handoff, phase controls and candidate route retain one event', async ({ page }, info) => {
  await page.goto(`${RECORDED_URL}&still=1`);
  await page.locator('.cinema-canvas[data-ready="true"] canvas').waitFor();
  const host = page.locator('.cinema-canvas');
  const cameraX = async () => Number((await host.getAttribute('data-camera'))!.split(',')[0]);
  for (const id of ['plasma', 'potencia', 'bowtie', 'centernet', 'resnet']) {
    const index = indexOf(id);
    await sequence(page, index, .58);
    const hold = await cameraX();
    await sequence(page, index, .69);
    expect(await cameraX()).toBeCloseTo(hold, 2);
    await expect(page.locator('.event-flow')).toHaveAttribute('data-phase', 'output');
    await sequence(page, index, .86);
    expect(await cameraX()).toBeGreaterThan(hold);
    await expect(page.locator('.event-flow')).toHaveAttribute('data-phase', 'handoff');
    await expect(host).toHaveAttribute('data-event-id', 'LF-241032');
    expect(await coloredScene(page), `${id} handoff must not become blank`).toBeGreaterThan(25);
    await page.screenshot({ path: `validation/screenshots/handoff-${info.project.name}-${id}.png` });
    await sequence(page, index + 1, .05);
    expect(await cameraX()).toBeGreaterThan(hold);
  }
  await sequence(page, indexOf('perfil'));
  const startingProgress = Number(await host.getAttribute('data-progress'));
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Number(await host.getAttribute('data-progress'))).toBeCloseTo(startingProgress + .0125, 3);
  await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', String(indexOf('perfil')));
  await page.getByRole('button', { name: 'Retroceder con precisión', exact: true }).click();
  await expect.poll(async () => Number(await host.getAttribute('data-progress'))).toBeCloseTo(startingProgress, 3);
  await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', String(indexOf('perfil')));
  await sequence(page, FINAL);
  await page.getByRole('button', { name: 'Ruta del candidato', exact: true }).click();
  await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  await expect(page.locator('.story-copy')).toHaveAttribute('data-sequence', String(indexOf('bowtie')));
});
