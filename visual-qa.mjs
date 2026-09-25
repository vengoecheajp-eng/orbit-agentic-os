import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const CHROME_PATH = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function runVisualQA({ previewUrl, runId, evidenceDir }) {
  mkdirSync(evidenceDir, { recursive: true });
  const desktopPath = join(evidenceDir, `${runId}-desktop.png`);
  const mobilePath = join(evidenceDir, `${runId}-mobile.png`);

  if (!existsSync(CHROME_PATH)) {
    return {
      status: 'skipped',
      reason: `Google Chrome was not found at ${CHROME_PATH}`
    };
  }

  let browser;
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  try {
    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore benign favicon or font 404s
        if (!text.includes('favicon.ico')) consoleErrors.push(text.slice(0, 300));
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message.slice(0, 300));
    });

    page.on('requestfailed', req => {
      const url = req.url();
      if (!url.includes('favicon.ico')) {
        failedRequests.push({ url, error: req.failure()?.errorText || 'Unknown request failure' });
      }
    });

    // Navigate to preview
    await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
    // Allow brief time for React / Vue hydration
    await page.waitForTimeout(1200);

    // Inspect DOM state
    const domCheck = await page.evaluate(() => {
      const body = document.body;
      const text = body ? (body.innerText || '').trim() : '';
      const hasOverlay = Boolean(document.querySelector('vite-error-overlay, nextjs-portal, #webpack-dev-server-client-overlay'));
      const root = document.querySelector('#root, #app, main, [data-reactroot]');
      const rootEmpty = root ? root.children.length === 0 && root.innerText.trim().length === 0 : false;
      const hasVisualElements = Boolean(document.querySelector('canvas, svg, img, button, a, h1, h2, p'));
      const isBlank = text.length < 15 && !hasVisualElements && rootEmpty;

      return {
        textSnippet: text.slice(0, 200),
        hasOverlay,
        isBlank
      };
    });

    // 1. Take Desktop screenshot
    await page.screenshot({ path: desktopPath, fullPage: false });

    // 2. Take Mobile screenshot (iPhone SE viewport)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: mobilePath, fullPage: false });

    const passed = !domCheck.hasOverlay && !domCheck.isBlank && pageErrors.length === 0;

    return {
      status: passed ? 'passed' : 'failed',
      blankScreen: domCheck.isBlank,
      errorOverlay: domCheck.hasOverlay,
      pageErrors: pageErrors.slice(0, 5),
      consoleErrors: consoleErrors.slice(0, 5),
      failedRequests: failedRequests.slice(0, 5),
      desktopScreenshot: `/api/runs/${runId}/evidence/desktop`,
      mobileScreenshot: `/api/runs/${runId}/evidence/mobile`,
      hasScreenshots: true,
      timestamp: new Date().toISOString(),
      summary: passed
        ? 'Visual QA verified: Zero blank screen, zero uncaught runtime exceptions.'
        : domCheck.hasOverlay
          ? 'Visual QA caught error overlay in UI.'
          : domCheck.isBlank
            ? 'Visual QA detected blank screen (empty root container).'
            : `Visual QA caught ${pageErrors.length} runtime error(s).`
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error.message,
      summary: `Visual QA execution error: ${error.message}`
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
