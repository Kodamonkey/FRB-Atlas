import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.env.CINEMA_URL || 'http://127.0.0.1:5174/';
const routes = [
  { detection: 'cnn', classification: 'resnet' },
  { detection: 'boxcar', classification: 'radio' },
  { detection: 'boxcar', classification: 'forest' },
  { detection: 'boxcar', classification: 'resnet' },
  { detection: 'transformer', classification: 'transformer' },
  { observation: 'alma-hf', detection: 'boxcar', classification: 'radio' },
];
const manifest = { exportedAt: new Date().toISOString(), url, operation: 1, paused: true, routes: [], files: [] };
const browser = await chromium.launch({ headless: true });
await mkdir(resolve('public/posters'), { recursive: true });
try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    const exported = new Set();
    for (const route of routes) {
      const target = new URL(url); target.searchParams.set('qa', '1'); target.searchParams.set('still', '1');
      target.searchParams.set('detector', route.detection); target.searchParams.set('classifier', route.classification);
      target.searchParams.set('observation', route.observation || 'arecibo-lf');
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(target.href);
        await page.locator('.cinema-canvas[data-ready="true"] canvas').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: '.site-header,.explanation-stack,.story-copy,.scientific-readout,.act-navigation,.journey-footer,.event-flow,.next-hint,.scene-shade,.transport-bar,.method-switcher,.plot-toolbar,.finale-panel { visibility: hidden !important; }' });
        const ids = await page.locator('.story-step').evaluateAll(steps => steps.map(step => step.dataset.storyId || step.id));
        if (ids.some(id => !id || !/^[a-z0-9-]+$/.test(id)) || new Set(ids).size !== ids.length) throw new Error('Invalid or duplicate scene IDs.');
        if (viewport.name === 'desktop') manifest.routes.push({ ...route, sceneCount: ids.length, sceneIds: ids });
        const prefetch = ids.indexOf('antenas');
        for (let sequence = 0; sequence < ids.length; sequence++) {
          const id = ids[sequence];
          const posterId = route.observation === 'alma-hf' || ['tierra', 'antenas'].includes(id)
            ? `${route.observation || 'arecibo-lf'}-${id}` : id;
          if (exported.has(posterId)) continue;
          await page.evaluate(index => {
            const steps = Array.from(document.querySelectorAll('.story-step'));
            const start = steps[index].offsetTop;
            const end = steps[index + 1]?.offsetTop ?? document.documentElement.scrollHeight - innerHeight;
            scrollTo(0, start + (end - start) * .64);
          }, sequence);
          await page.waitForFunction(({ index, id }) => {
            const state = window.__CINEMA__, host = document.querySelector('.cinema-canvas');
            return state?.sequence === index && state.stageId === id && Math.abs(state.local - .64) < .01
              && host?.dataset.stageId === id && +host.dataset.operation === 1 && +host.dataset.handoff === 0
              && host.dataset.renderMode === 'on-demand';
          }, { index: sequence, id });
          if (route.observation !== 'alma-hf' && prefetch >= 0 && sequence >= prefetch) await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
          if (id === 'tierra') await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/media/earth-blue-marble.png')));
          await page.waitForTimeout(180);
          const name = `${viewport.name}-${posterId}.jpg`;
          await page.locator('.cinema-canvas canvas').screenshot({ path: resolve('public/posters', name), type: 'jpeg', quality: 86 });
          exported.add(posterId); manifest.files.push({ name, sceneId: id, observation: route.observation || 'arecibo-lf', viewport: viewport.name, route });
        }
        if (errors.length) throw new Error(`Poster route ${route.detection}/${route.classification}: ${errors.join('; ')}`);
      } finally { await page.close(); }
    }
  }
} finally { await browser.close(); }
await writeFile(resolve('public/posters/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${manifest.files.length} canvas-only posters exported by observing case and scene ID. Existing images preserved.`);
