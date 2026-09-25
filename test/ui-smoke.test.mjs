import { chromium } from 'playwright-core';
import { describe, expect, inject, it } from 'vitest';
import { findChrome } from './browser.mjs';

const chrome = findChrome();
const runBrowserCheck = Boolean(chrome);
if (process.env.CI && !runBrowserCheck) throw new Error('CI browser was not found. Set CHROME_BIN after installing Chromium.');

describe('Orbit isolated browser smoke test', () => {
  it.runIf(runBrowserCheck)('renders a usable bilingual workspace and dismisses a modal from the keyboard', async () => {
    const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    try {
      const base = inject('orbitBase');
      const profileResponse = await fetch(`${base}/api/profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Community Tester', role: 'Tester', workspace: 'Release check' }) });
      expect(profileResponse.ok).toBe(true);
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('header');
      expect(await page.locator('main h1').count()).toBe(1);

      const languageButton = page.getByRole('button', { name: 'Change language' });
      await languageButton.focus();
      const focus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label') }));
      expect(focus).toEqual({ tag: 'BUTTON', label: 'Change language' });

      await languageButton.click();
      expect(await page.locator('html').getAttribute('lang')).toBe('es');
      expect(await page.getByRole('button', { name: 'Nuevo proyecto' }).isVisible()).toBe(true);
      await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
      expect(await page.locator('.new-modal').isVisible()).toBe(true);
      await page.locator('.new-modal input').fill('Typing safely');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      expect(await page.locator('.new-modal').count()).toBe(0);
      await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
      expect(await page.locator('.new-modal input').inputValue()).toBe('Typing safely');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      expect(await page.locator('.new-modal').count()).toBe(0);
    } finally {
      await browser.close();
    }
  }, 30000);

  it.runIf(runBrowserCheck)('clicking Run on a task opens Agent Console with prefilled task and selectable model', async () => {
    const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    try {
      const base = inject('orbitBase');
      const projects = await (await fetch(`${base}/api/projects`)).json();
      const project = projects[0];
      const seeded = await fetch(`${base}/api/projects/${project.id}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [['Build the first safe feature', 'Next', false]], progress: 0 })
      });
      expect(seeded.ok).toBe(true);
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('header');

      // Click the first task run button in the upcoming tasks list
      const taskRunButton = page.locator('.task-run-btn').first();
      await page.waitForSelector('.task-run-btn');
      expect(await taskRunButton.isVisible()).toBe(true);
      await taskRunButton.click();

      // Should automatically navigate to Agent Console
      await page.waitForSelector('.agent-console');
      expect(await page.locator('.agent-console').isVisible()).toBe(true);

      // Task prefill banner should be visible
      await page.waitForSelector('.task-prefill-banner');
      expect(await page.locator('.task-prefill-banner').isVisible()).toBe(true);
      expect(await page.locator('.task-prefill-title').textContent()).toBeTruthy();

      // Provider and prompt should be populated
      const promptValue = await page.locator('.run-form textarea').inputValue();
      expect(promptValue.length).toBeGreaterThan(10);

      // Model selector should exist and let user select provider and exact model
      const providerSelect = page.locator('.run-form select').nth(1);
      expect(await providerSelect.isVisible()).toBe(true);
    } finally {
      await browser.close();
    }
  }, 30000);
});
