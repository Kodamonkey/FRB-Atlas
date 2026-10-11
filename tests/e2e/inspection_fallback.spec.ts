import { test, expect } from '@playwright/test';

test('context loss during 3D inspection restores fallback explanations and units', async ({ page }) => {
  await page.goto('/?qa=1&still=1&observation=alma-hf');
  const host = page.locator('.cinema-canvas');
  await expect(host).toHaveAttribute('data-ready', 'true');
  const ids = await page.locator('.story-step').evaluateAll(steps => steps.map(step => step.id));
  await page.getByRole('slider', { name: 'Posición en el recorrido', exact: true }).evaluate((element, value) => {
    (element as HTMLInputElement).value = String(value); element.dispatchEvent(new Event('input', { bubbles: true }));
  }, ids.indexOf('hf-matriz') + .64);
  await expect(host).toHaveAttribute('data-stage-id', 'hf-matriz');
  await page.getByRole('button', { name: 'Explorar gráfico en 3D', exact: true }).click();
  await expect(host).toHaveAttribute('data-inspection', 'true');
  await host.locator('canvas').evaluate(element => {
    element.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect(page.locator('.poster-surface')).toBeVisible();
  await expect(page.locator('.math-panel')).toBeVisible();
  await expect(page.locator('.math-panel')).toHaveAttribute('data-stage', 'hf-matriz');
  await expect(page.locator('.term-unit')).toBeVisible();
  await expect(page.locator('.term-unit')).toHaveText('ms');
  await expect(host).toHaveAttribute('data-inspection', 'false');
  await expect(page.locator('.plot-toolbar')).toHaveCount(0);
  await expect(host).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('button', { name: 'Pausar movimiento', exact: true })).toHaveCount(0);
});
