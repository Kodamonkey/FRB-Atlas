import { chromium } from '@playwright/test';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const url = process.env.CINEMA_URL || 'http://127.0.0.1:5175/';
const target = new URL(url); target.searchParams.set('qa', '1'); target.searchParams.delete('still');
if (process.env.CINEMA_DETECTOR) target.searchParams.set('detector', process.env.CINEMA_DETECTOR);
if (process.env.CINEMA_CLASSIFIER) target.searchParams.set('classifier', process.env.CINEMA_CLASSIFIER);
const browser = await chromium.launch({ headless: true });
const reports = [];
const SAMPLE_SCENES = ['anfitriona', 'galaxia', 'polarizacion', 'tierra', 'antenas', 'matriz', 'bowtie', 'metodos', 'candidato', 'candidate-didactic',
  'hf-resolution', 'hf-matriz', 'hf-profile', 'hf-boxcar', 'hf-candidato'];

async function visitScene(page, index, local = .64) {
  const id = await page.locator('.story-step').nth(index).getAttribute('data-story-id');
  await page.evaluate(({ index, local }) => {
    const steps = Array.from(document.querySelectorAll('.story-step'));
    const end = steps[index + 1]?.offsetTop ?? document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, steps[index].offsetTop + (end - steps[index].offsetTop) * local);
  }, { index, local });
  await page.waitForFunction(({ index, id, local }) => {
    const state = window.__CINEMA__, host = document.querySelector('.cinema-canvas');
    return state?.sequence === index && state.stageId === id && Math.abs(state.local - local) < .01
      && host?.dataset.stageId === id && +host.dataset.operation === 1 && +host.dataset.handoff === 0;
  }, { index, id, local });
  return id;
}

async function frameIntervals(page, count) {
  return page.evaluate(count => new Promise(done => {
    const frames = []; let last;
    function frame(now) { if (last !== undefined) frames.push(now - last); last = now;
      if (frames.length < count) requestAnimationFrame(frame); else done(frames); }
    requestAnimationFrame(frame);
  }), count);
}

function frameSummary(intervals) {
  const sorted = [...intervals].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor((sorted.length - 1) * .95)] };
}

try {
  for (const observation of ['arecibo-lf', 'alma-hf']) for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    target.searchParams.set('observation', observation);
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__longTasks = [];
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__longTasks.push({ start: entry.startTime, duration: entry.duration }); }).observe({ type: 'longtask', buffered: true });
    });
    await page.goto(target.href);
    await page.locator('.cinema-canvas[data-ready="true"] canvas').waitFor();
    await page.waitForFunction(() => +document.querySelector('.cinema-canvas').dataset.frames > 0
      && +document.querySelector('.cinema-canvas').dataset.pixels > 0 && window.__CINEMA__?.stageId);
    await page.evaluate(() => document.fonts.ready);
    const initial = await page.evaluate(() => ({ readyMs: performance.now(), evidenceStatus: document.querySelector('.cinema-canvas').dataset.evidence,
      route: { observation: window.__CINEMA__?.observation, detection: window.__CINEMA__?.detection,
        classification: window.__CINEMA__?.classification, recorded: window.__CINEMA__?.recorded },
      sceneCount: document.querySelectorAll('.story-step').length,
      controls: { position: { min: +document.querySelector('.transport-range').min, max: +document.querySelector('.transport-range').max,
        step: document.querySelector('.transport-range').step },
        holdSpeedPhasesPerSecond: +document.querySelector('.transport-speed input').value,
        buttonNames: Array.from(document.querySelectorAll('.transport-bar button'), button => button.getAttribute('aria-label')) },
      resources: performance.getEntriesByType('resource').map(entry => ({ path: new URL(entry.name).pathname, bytes: entry.encodedBodySize, decodedBytes: entry.decodedBodySize })),
      canvasPixels: Number(document.querySelector('.cinema-canvas').dataset.pixels) }));
    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable'); await session.send('HeapProfiler.collectGarbage');
    const heap = async () => (await session.send('Performance.getMetrics')).metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value;
    const initialHeap = await heap();
    console.log(`Initial view ${viewport.width}x${viewport.height}: ${initial.readyMs.toFixed(0)} ms, evidence ${initial.evidenceStatus}`);
    const intervals = await frameIntervals(page, 90);
    const ids = await page.locator('.story-step').evaluateAll(steps => steps.map(step => step.dataset.storyId || step.id));
    const sequenceCount = ids.length, prefetch = ids.indexOf('antenas');
    const controlStart = performance.now();
    await page.locator('.transport-range').focus();
    const beforeNudge = await page.locator('.transport-range').inputValue();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(value => +document.querySelector('.transport-range').value > value, +beforeNudge);
    const afterNudge = await page.locator('.transport-range').inputValue();
    const controlLatencyMs = performance.now() - controlStart;
    await page.keyboard.press('ArrowLeft');
    await page.locator('.transport-range').evaluate(input => input.blur());
    const counts = [];
    const heapsAfterTours = [];
    const sceneFrames = [];
    for (let tour = 0; tour < 3; tour++) {
      for (let sequence = 0; sequence < sequenceCount; sequence++) {
        const sceneId = await visitScene(page, sequence);
        if (observation === 'arecibo-lf' && prefetch >= 0 && sequence >= prefetch) await page.locator('.cinema-canvas[data-evidence="verified"]').waitFor();
        if (sceneId === 'tierra') await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/media/earth-blue-marble.png')));
        await page.waitForTimeout(150);
        if (tour === 0 && SAMPLE_SCENES.includes(sceneId)) {
          const before = await page.locator('.cinema-canvas').evaluate(element => ({ frames: +element.dataset.frames, mode: element.dataset.renderMode }));
          const frames = await frameIntervals(page, 30);
          const after = await page.locator('.cinema-canvas').evaluate(element => +element.dataset.frames);
          sceneFrames.push({ sequence, sceneId, renderMode: before.mode, drawFramesDuring30Opportunities: after - before.frames, ...frameSummary(frames) });
        }
      }
      // Paused progress writes refresh renderer diagnostics even for held on-demand scenes.
      await page.getByRole('button', { name: 'Pausar movimiento', exact: true }).click();
      await page.evaluate(() => scrollBy(0, -1));
      await page.waitForFunction(() => document.querySelector('.cinema-canvas')?.dataset.renderMode === 'on-demand');
      await page.waitForTimeout(60);
      counts.push(await page.locator('.cinema-canvas').evaluate(element => ({ geometries: +element.dataset.geometries, textures: +element.dataset.textures, drawCalls: +element.dataset.drawCalls })));
      await page.getByRole('button', { name: 'Reanudar movimiento', exact: true }).click();
      await session.send('HeapProfiler.collectGarbage');
      heapsAfterTours.push(await heap());
      console.log(`Tour ${tour + 1}/3 complete at ${viewport.width}x${viewport.height}`);
    }
    await session.send('HeapProfiler.collectGarbage');
    const finalHeap = await heap();
    await page.getByRole('button', { name: 'Pausar movimiento', exact: true }).click();
    await page.waitForTimeout(120);
    const pausedBefore = await page.locator('.cinema-canvas').evaluate(element => +element.dataset.frames);
    await page.waitForTimeout(600);
    const pausedAfter = await page.locator('.cinema-canvas').evaluate(element => +element.dataset.frames);
    const finalResources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => ({ path: new URL(entry.name).pathname,
      bytes: entry.encodedBodySize, decodedBytes: entry.decodedBodySize })));
    reports.push({ viewport, ...initial, initialBytes: initial.resources.reduce((sum, item) => sum + item.bytes, 0),
      sceneIds: ids, elapsedMs: await page.evaluate(() => performance.now()),
      preciseControl: { before: +beforeNudge, after: +afterNudge, deltaPhases: +afterNudge - +beforeNudge,
        roundTripBrowserControlMs: controlLatencyMs, note: 'Includes Playwright focus, input and browser synchronization; not device input latency.' },
      pausedDrawFramesIn600Ms: pausedAfter - pausedBefore,
      finalResources, finalBytes: finalResources.reduce((sum, item) => sum + item.bytes, 0),
      rAF: { ...frameSummary(intervals), note: 'Browser rendering opportunities, not measured physical GPU throughput.' },
      sceneFrames,
      heapMainThreadBytes: { initialAfterGC: initialHeap, afterEachTourAfterGC: heapsAfterTours, afterThreeToursAfterGC: finalHeap, note: 'JSHeapUsedSize; may exclude ArrayBuffer backing stores. Excludes Workers, GPU and browser process memory.' },
      resourceCountsAfterTours: counts, errors, longTasks: await page.evaluate(() => window.__longTasks),
      horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) });
    await page.close();
  }
} finally { await browser.close(); }
const assets = [];
for (const name of await readdir(resolve('dist/assets'))) {
  if (!name.endsWith('.js') && !name.endsWith('.css')) continue;
  const bytes = await readFile(resolve('dist/assets', name));
  assets.push({ name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
}
await mkdir(resolve('validation'), { recursive: true });
const report = { measuredAt: new Date().toISOString(), url: target.href, environment: 'Windows, Chromium headless, gzip local production, no network throttling', reports, assets };
await writeFile(resolve('validation/performance.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ reports: reports.map(({ resources, longTasks, ...rest }) => rest), assets }, null, 2));
